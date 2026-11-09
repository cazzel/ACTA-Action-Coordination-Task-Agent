"""ACTA external integrations: Telegram notifications and company-scoped Google Calendar OAuth.

OAuth refresh tokens remain in the backend-only company_integrations table and are never returned to browsers.
"""
from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, quote
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase_client, get_admin_supabase_client
from app.auth_context import current_company_id, get_current_user_id

logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

FRONTEND_URL = os.getenv("ACTA_FRONTEND_URL", "http://localhost:5173").rstrip("/")
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
TELEGRAM_API_BASE = "https://api.telegram.org"
_OAUTH_STATES: dict[str, float] = {}  # retained only for compatibility with older in-process states


class CalendarEventRequest(BaseModel):
    meeting_id: str = Field(min_length=1, max_length=100)
    start_time: datetime
    end_time: datetime
    timezone: str = Field(default="Asia/Jakarta", min_length=1, max_length=100)
    description: str = Field(default="", max_length=4000)
    location: str = Field(default="", max_length=500)


def _telegram_configured() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN", "").strip() and os.getenv("TELEGRAM_CHAT_ID", "").strip())


def send_telegram_message(text: str, chat_id: str | None = None) -> dict[str, Any]:
    """Send a Telegram message and verify the Bot API's `ok` response."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = (chat_id or os.getenv("TELEGRAM_CHAT_ID", "")).strip()
    if not token or not chat_id:
        return {"configured": False, "sent": False, "reason": "Telegram bot token or chat ID is not configured."}

    clean_text = (text or "").strip()[:4000]
    if not clean_text:
        return {"configured": True, "sent": False, "reason": "Message text is empty."}

    try:
        response = httpx.post(
            f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": clean_text, "disable_web_page_preview": True},
            timeout=httpx.Timeout(10.0, connect=5.0),
        )
    except httpx.HTTPError as exc:
        logger.warning("Telegram sendMessage request failed (%s)", type(exc).__name__)
        return {"configured": True, "sent": False, "reason": "Could not reach Telegram API."}

    try:
        payload = response.json()
        if not isinstance(payload, dict):
            payload = {}
    except ValueError:
        payload = {}

    if not response.is_success or payload.get("ok") is not True:
        logger.warning("Telegram sendMessage failed with HTTP %s", response.status_code)
        return {"configured": True, "sent": False, "reason": "Telegram rejected the message. Check the bot token, chat ID, and bot access."}

    return {"configured": True, "sent": True, "message_id": (payload.get("result") or {}).get("message_id")}


def notify_telegram_task_event(event: str, item: dict[str, Any]) -> dict[str, Any]:
    """Best-effort company-specific Telegram notification after a task state change."""
    if not os.getenv("TELEGRAM_BOT_TOKEN", "").strip():
        return {"configured": False, "sent": False, "reason": "Telegram bot token is not configured."}
    company_id = str(item.get("company_id") or "").strip()
    chat_id = ""
    if company_id:
        try:
            prefs = get_supabase_client().table("telegram_digest_preferences").select("chat_id").eq("company_id", company_id).limit(1).execute().data or []
            chat_id = str((prefs[0] if prefs else {}).get("chat_id") or "").strip()
        except Exception as exc:
            logger.warning("Could not load company Telegram destination (%s)", type(exc).__name__)
    if not chat_id or chat_id == "NOT_CONFIGURED":
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not chat_id:
        return {"configured": False, "sent": False, "reason": "No Telegram destination is configured for this company."}

    labels = {
        "approved": "Task approved",
        "in_progress": "Task started",
        "done": "Task completed",
        "rejected": "Task rejected",
    }
    label = labels.get(event, f"Task status: {event}")
    task = str(item.get("task") or "Untitled task").strip()
    deadline = str(item.get("deadline_text") or "Not set").strip()
    message = f"ACTA — {label}\nTask: {task}\nDeadline: {deadline}\nTask ID: {item.get('id', 'unknown')}"
    try:
        return send_telegram_message(message, chat_id=chat_id)
    except Exception as exc:
        # An external notification must never turn a successful DB mutation into an API error.
        logger.warning("Telegram task notification could not be sent (%s)", type(exc).__name__)
        return {"configured": True, "sent": False, "reason": "Telegram notification failed; the ACTA task change was saved."}


def _google_configured() -> bool:
    return bool(
        os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip()
        and os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "").strip()
    )


def _google_redirect_uri() -> str:
    return os.getenv(
        "GOOGLE_CALENDAR_REDIRECT_URI",
        "http://localhost:8000/api/integrations/google-calendar/callback",
    ).strip()


def _load_token_data(company_id: str | None = None, *, admin: bool = False) -> dict[str, Any]:
    """Load Google OAuth credentials for one company; never share one local token file."""
    scoped_company_id = company_id or current_company_id()
    client = get_admin_supabase_client()
    rows = client.table("company_integrations").select("config,status").eq("company_id", scoped_company_id).eq("provider", "google_calendar").limit(1).execute().data or []
    if not rows or rows[0].get("status") != "connected":
        return {}
    config = rows[0].get("config")
    return config if isinstance(config, dict) else {}


def _save_token_data(data: dict[str, Any], company_id: str | None = None, *, admin: bool = False) -> None:
    scoped_company_id = company_id or current_company_id()
    client = get_admin_supabase_client()
    client.table("company_integrations").upsert({
        "company_id": scoped_company_id,
        "provider": "google_calendar",
        "config": data,
        "status": "connected" if data.get("refresh_token") else "disconnected",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="company_id,provider").execute()


def _refresh_google_token(token_data: dict[str, Any], company_id: str | None = None, *, admin: bool = False) -> dict[str, Any]:
    refresh_token = str(token_data.get("refresh_token") or "").strip()
    client_id = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "").strip()
    if not refresh_token or not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="Google Calendar is not authorized. Connect it from ACTA Integrations first.")
    try:
        response = httpx.post(
            GOOGLE_TOKEN_URL,
            data={"client_id": client_id, "client_secret": client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"},
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
    except httpx.HTTPError as exc:
        logger.warning("Google OAuth token refresh failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Could not reach Google OAuth to refresh the Calendar token.") from exc
    if not response.is_success:
        logger.warning("Google OAuth token refresh returned HTTP %s", response.status_code)
        raise HTTPException(status_code=502, detail="Google Calendar authorization expired or was revoked. Reconnect the account.")
    payload = response.json()
    token_data["access_token"] = payload.get("access_token", "")
    token_data["expires_at"] = int(time.time()) + int(payload.get("expires_in", 3600)) - 60
    token_data["refresh_token"] = refresh_token
    _save_token_data(token_data, company_id, admin=admin)
    return token_data


def _google_access_token(company_id: str | None = None) -> str:
    token_data = _load_token_data(company_id)
    if not token_data.get("refresh_token"):
        raise HTTPException(status_code=503, detail="Google Calendar is not authorized for this company. Connect it from ACTA Integrations first.")
    if not token_data.get("access_token") or int(token_data.get("expires_at", 0)) <= int(time.time()) + 30:
        token_data = _refresh_google_token(token_data, company_id)
    access_token = str(token_data.get("access_token") or "").strip()
    if not access_token:
        raise HTTPException(status_code=503, detail="Google Calendar access token is unavailable. Reconnect the account.")
    return access_token


def _google_request(method: str, url: str, **kwargs: Any) -> httpx.Response:
    company_id = current_company_id()
    token = _google_access_token(company_id)
    headers = dict(kwargs.pop("headers", {}) or {})
    headers["Authorization"] = f"Bearer {token}"
    try:
        response = httpx.request(method, url, headers=headers, timeout=httpx.Timeout(20.0, connect=5.0), **kwargs)
        if response.status_code == 401:
            token_data = _refresh_google_token(_load_token_data(company_id), company_id)
            headers["Authorization"] = f"Bearer {token_data.get('access_token', '')}"
            response = httpx.request(method, url, headers=headers, timeout=httpx.Timeout(20.0, connect=5.0), **kwargs)
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.warning("Google Calendar API request failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Could not reach the Google Calendar API.") from exc
    if not response.is_success:
        logger.warning("Google Calendar API returned HTTP %s", response.status_code)
        if response.status_code in (401, 403):
            detail = "Google Calendar rejected the request. Check authorization and Calendar API permissions."
        elif response.status_code == 404:
            detail = "The selected Google Calendar was not found. Check GOOGLE_CALENDAR_ID."
        else:
            detail = f"Google Calendar returned HTTP {response.status_code}. Check the Calendar setup and retry."
        raise HTTPException(status_code=502, detail=detail)
    return response


def _google_datetime(value: datetime, timezone_name: str) -> dict[str, str]:
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone. Use an IANA timezone such as Asia/Jakarta.") from exc
    if value.tzinfo is None:
        value = value.replace(tzinfo=zone)
    else:
        value = value.astimezone(zone)
    return {"dateTime": value.isoformat(timespec="seconds"), "timeZone": timezone_name}


def build_integrations_router() -> APIRouter:
    router = APIRouter(prefix="/api/integrations", tags=["integrations"])

    @router.get("/status")
    def integrations_status():
        token_data = _load_token_data(current_company_id())
        calendar_authorized = bool(token_data.get("refresh_token"))
        provider = os.getenv("ACTA_TRANSCRIPTION_PROVIDER", "").strip().lower()
        if not provider:
            provider = "groq" if os.getenv("GROQ_API_KEY", "").strip() else ("openai" if os.getenv("OPENAI_API_KEY", "").strip() else "")
        return {
            "telegram": {"configured": _telegram_configured()},
            "google_calendar": {"configured": _google_configured(), "authorized": calendar_authorized},
            "transcription": {"configured": bool(provider and ((provider == "groq" and os.getenv("GROQ_API_KEY", "").strip()) or (provider == "openai" and os.getenv("OPENAI_API_KEY", "").strip()))), "provider": provider or None},
        }

    @router.post("/telegram/test")
    def telegram_test():
        if not _telegram_configured():
            raise HTTPException(status_code=503, detail="Telegram is not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to the backend .env file.")
        result = send_telegram_message("✅ ACTA Telegram integration test succeeded. Notifications are connected.")
        if not result.get("sent"):
            raise HTTPException(status_code=502, detail=result.get("reason") or "Telegram test message failed.")
        return {"message": "Telegram test message sent successfully.", "data": {"sent": True}}

    @router.get("/google-calendar/auth-url")
    def google_calendar_auth_url():
        if not _google_configured():
            raise HTTPException(status_code=503, detail="Google Calendar OAuth is not configured. Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to the backend .env file.")
        state = secrets.token_urlsafe(32)
        company_id = current_company_id()
        state_hash = __import__("hashlib").sha256(state.encode("utf-8")).hexdigest()
        now_utc = datetime.now(timezone.utc)
        get_admin_supabase_client().table("acta_oauth_states").insert({
            "provider": "google_calendar", "state_hash": state_hash,
            "company_id": company_id, "created_by": get_current_user_id(),
            "expires_at": (now_utc + timedelta(minutes=10)).isoformat(),
        }).execute()
        query = urlencode({
            "client_id": os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip(),
            "redirect_uri": _google_redirect_uri(),
            "response_type": "code",
            "scope": GOOGLE_CALENDAR_SCOPE,
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "consent",
            "state": state,
        })
        return {"auth_url": f"{GOOGLE_AUTH_URL}?{query}"}

    @router.get("/google-calendar/callback")
    def google_calendar_callback(code: str | None = None, state: str | None = None, error: str | None = None):
        if error:
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_denied", status_code=303)
        if not code or not state:
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_state", status_code=303)
        state_hash = __import__("hashlib").sha256(state.encode("utf-8")).hexdigest()
        admin = get_admin_supabase_client()
        state_rows = admin.table("acta_oauth_states").select("id,company_id,expires_at").eq("state_hash", state_hash).eq("provider", "google_calendar").limit(1).execute().data or []
        if not state_rows:
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_state", status_code=303)
        oauth_state = state_rows[0]
        admin.table("acta_oauth_states").delete().eq("id", oauth_state["id"]).execute()
        expires = datetime.fromisoformat(str(oauth_state["expires_at"]).replace("Z", "+00:00"))
        if expires <= datetime.now(timezone.utc):
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_expired", status_code=303)
        company_id = str(oauth_state["company_id"])

        try:
            response = httpx.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip(),
                    "client_secret": os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "").strip(),
                    "redirect_uri": _google_redirect_uri(),
                    "grant_type": "authorization_code",
                },
                timeout=httpx.Timeout(20.0, connect=5.0),
            )
        except httpx.HTTPError as exc:
            logger.warning("Google OAuth callback failed (%s)", type(exc).__name__)
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_network", status_code=303)

        if not response.is_success:
            logger.warning("Google OAuth code exchange returned HTTP %s", response.status_code)
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_exchange", status_code=303)

        try:
            tokens = response.json()
        except ValueError:
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_response", status_code=303)
        previous = _load_token_data(company_id, admin=True)
        refresh_token = tokens.get("refresh_token") or previous.get("refresh_token")
        if not refresh_token:
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_refresh", status_code=303)
        token_data = {
            "access_token": tokens.get("access_token", ""),
            "refresh_token": refresh_token,
            "expires_at": int(time.time()) + int(tokens.get("expires_in", 3600)) - 60,
            "scope": tokens.get("scope", GOOGLE_CALENDAR_SCOPE),
            "token_type": tokens.get("token_type", "Bearer"),
        }
        try:
            _save_token_data(token_data, company_id, admin=True)
        except Exception:
            logger.exception("Could not save the Google Calendar token for this company")
            return RedirectResponse(f"{FRONTEND_URL}/?integration_error=google_calendar_storage", status_code=303)
        return RedirectResponse(f"{FRONTEND_URL}/?integration=google_calendar_connected", status_code=303)

    @router.post("/google-calendar/events")
    def create_or_update_google_calendar_event(payload: CalendarEventRequest):
        # Compare both values in the requested timezone to avoid naive/aware datetime errors.
        start_for_compare = _google_datetime(payload.start_time, payload.timezone)
        end_for_compare = _google_datetime(payload.end_time, payload.timezone)
        start_compare = datetime.fromisoformat(start_for_compare["dateTime"])
        end_compare = datetime.fromisoformat(end_for_compare["dateTime"])
        if end_compare <= start_compare:
            raise HTTPException(status_code=400, detail="The event end time must be after its start time.")

        client = get_supabase_client()
        try:
            rows = (
                client.table("meetings")
                .select("id, title, company_id")
                .eq("id", payload.meeting_id)
                .limit(1)
                .execute()
                .data or []
            )
        except Exception as exc:
            logger.exception("Could not load meeting for Calendar event")
            raise HTTPException(status_code=503, detail="Could not load this meeting from Supabase.") from exc
        if not rows:
            raise HTTPException(status_code=404, detail="Meeting not found in ACTA.")

        meeting = rows[0]
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary").strip() or "primary"
        calendar_url = f"{GOOGLE_CALENDAR_API}/calendars/{quote(calendar_id, safe='')}/events"
        meeting_id = str(meeting.get("id"))
        description = payload.description.strip()
        description_parts = [description] if description else []
        description_parts.append(f"Created from ACTA. Meeting ID: {meeting_id}")
        event = {
            "summary": str(meeting.get("title") or "ACTA meeting"),
            "description": "\n\n".join(description_parts),
            "start": _google_datetime(payload.start_time, payload.timezone),
            "end": _google_datetime(payload.end_time, payload.timezone),
            "extendedProperties": {"private": {"actaMeetingId": meeting_id}},
        }
        if payload.location.strip():
            event["location"] = payload.location.strip()

        existing_response = _google_request(
            "GET",
            calendar_url,
            params={"privateExtendedProperty": f"actaMeetingId={meeting_id}", "maxResults": 10},
        )
        existing_items = (existing_response.json() or {}).get("items") or []
        try:
            if existing_items:
                event_id = existing_items[0].get("id")
                saved = _google_request("PATCH", f"{calendar_url}/{quote(str(event_id), safe='')}", json=event).json()
                action = "updated"
            else:
                saved = _google_request("POST", calendar_url, json=event).json()
                action = "created"
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Could not create/update Google Calendar event")
            raise HTTPException(status_code=502, detail="Could not create the Google Calendar event.") from exc

        return {
            "message": f"Google Calendar event {action} successfully.",
            "data": {"id": saved.get("id"), "htmlLink": saved.get("htmlLink"), "status": saved.get("status"), "action": action},
        }

    return router
