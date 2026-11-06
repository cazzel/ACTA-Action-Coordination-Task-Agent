"""Daily Telegram task digest for ACTA workspaces.

The scheduled endpoint is deliberately protected by ACTA_CRON_SECRET. The
scheduler should call it every 15 minutes; this service checks each preference
using its own IANA timezone and sends at most one digest per chat per local day.
"""
from __future__ import annotations

import hmac
import logging
import os
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase_client
from app.deadline_parser import parse_explicit_deadline

logger = logging.getLogger(__name__)
TELEGRAM_API_BASE = "https://api.telegram.org"
DEFAULT_COMPANY_ID = "nova"
DEFAULT_TIMEZONE = "Asia/Jakarta"
MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
WEEKDAYS_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


class DigestPreferencesPayload(BaseModel):
    company_id: str = Field(default=DEFAULT_COMPANY_ID, min_length=1, max_length=100)
    chat_id: str | None = Field(default=None, max_length=100)
    enabled: bool = False
    send_time: str = Field(default="07:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone_name: str = Field(default=DEFAULT_TIMEZONE, min_length=1, max_length=100)
    include_overdue: bool = True
    include_due_today: bool = True
    include_due_soon: bool = True
    due_soon_days: int = Field(default=7, ge=1, le=30)
    include_pending_review: bool = True
    include_in_progress: bool = True
    include_approved: bool = True


def _telegram_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def _send_telegram(text: str, chat_id: str) -> dict[str, Any]:
    token = _telegram_token()
    if not token:
        raise HTTPException(status_code=503, detail="TELEGRAM_BOT_TOKEN is not configured on the backend.")
    if not chat_id:
        raise HTTPException(status_code=400, detail="A Telegram destination chat ID is required.")
    chunks = [text[i:i + 3900] for i in range(0, len(text), 3900)] or ["ACTA daily task recap: no active tasks."]
    message_ids: list[int] = []
    for chunk in chunks:
        try:
            response = httpx.post(
                f"{TELEGRAM_API_BASE}/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": chunk, "disable_web_page_preview": True},
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Telegram digest delivery failed (%s)", type(exc).__name__)
            raise HTTPException(status_code=502, detail="Could not deliver the Telegram digest.") from exc
        if not response.is_success or not isinstance(payload, dict) or payload.get("ok") is not True:
            logger.warning("Telegram digest was rejected (HTTP %s)", response.status_code)
            raise HTTPException(status_code=502, detail="Telegram rejected the daily digest. Check the bot destination and permissions.")
        result = payload.get("result") or {}
        if result.get("message_id") is not None:
            message_ids.append(int(result["message_id"]))
    return {"sent": True, "message_ids": message_ids}


def _date_label(day: date) -> str:
    return f"{WEEKDAYS_ID[day.weekday()]}, {day.day} {MONTHS_ID[day.month - 1]} {day.year}"


def _deadline_date(task: dict[str, Any], zone: ZoneInfo) -> date | None:
    raw = task.get("deadline_at")
    if not raw and task.get("deadline_text"):
        raw = parse_explicit_deadline(task.get("deadline_text"), zone.key)
    if raw:
        try:
            if isinstance(raw, str):
                raw = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if isinstance(raw, datetime):
                if raw.tzinfo is None:
                    raw = raw.replace(tzinfo=timezone.utc)
                return raw.astimezone(zone).date()
        except (ValueError, TypeError):
            return None
    return None


def _build_digest(company_name: str, tasks: list[dict[str, Any]], day: date, zone: ZoneInfo, prefs: dict[str, Any]) -> tuple[str, int]:
    buckets: dict[str, list[dict[str, Any]]] = {
        "overdue": [], "today": [], "due_soon": [], "pending": [], "progress": [], "approved": [], "other": []
    }
    for task in tasks:
        status = str(task.get("status") or "").lower()
        deadline = _deadline_date(task, zone)
        due_soon_days = max(1, min(30, int(prefs.get("due_soon_days") or 7)))
        if deadline and deadline < day and prefs.get("include_overdue", True):
            buckets["overdue"].append(task)
        elif deadline == day and prefs.get("include_due_today", True):
            buckets["today"].append(task)
        elif deadline and day < deadline <= day + timedelta(days=due_soon_days) and prefs.get("include_due_soon", True):
            buckets["due_soon"].append(task)
        elif status == "pending_review" and prefs.get("include_pending_review", True):
            buckets["pending"].append(task)
        elif status == "in_progress" and prefs.get("include_in_progress", True):
            buckets["progress"].append(task)
        elif status == "approved" and prefs.get("include_approved", True):
            buckets["approved"].append(task)
        else:
            buckets["other"].append(task)

    sections: list[tuple[str, list[dict[str, Any]]]] = []
    if prefs.get("include_overdue", True):
        sections.append(("🔴 OVERDUE", buckets["overdue"]))
    if prefs.get("include_due_today", True):
        sections.append(("🟠 DUE TODAY", buckets["today"]))
    if prefs.get("include_due_soon", True):
        sections.append((f"🟡 DUE IN THE NEXT {max(1, min(30, int(prefs.get('due_soon_days') or 7)))} DAYS", buckets["due_soon"]))
    if prefs.get("include_pending_review", True):
        sections.append(("🟣 WAITING FOR APPROVAL", buckets["pending"]))
    if prefs.get("include_in_progress", True):
        sections.append(("🔵 IN PROGRESS", buckets["progress"]))
    if prefs.get("include_approved", True):
        sections.append(("🟢 APPROVED / UPCOMING", buckets["approved"]))
    sections.append(("⚪ OTHER ACTIVE TASKS", buckets["other"]))

    lines = [f"ACTA — DAILY TASK RECAP", company_name, _date_label(day), ""]
    total = 0
    for heading, rows in sections:
        if not rows:
            continue
        lines.append(f"{heading} ({len(rows)})")
        for item in rows[:20]:
            task = str(item.get("task") or "Untitled task").replace("\n", " ").strip()
            owner = str(item.get("selected_owner_name") or item.get("owner_mentioned") or "Belum ditentukan").strip()
            deadline = str(item.get("deadline_text") or "")
            exact_day = _deadline_date(item, zone)
            if exact_day:
                deadline = exact_day.strftime("%d/%m/%Y")
            suffix = f" | Deadline: {deadline}" if deadline else ""
            lines.append(f"• {task} — PIC: {owner}{suffix}")
            total += 1
        if len(rows) > 20:
            lines.append(f"…dan {len(rows) - 20} tugas lainnya.")
        lines.append("")
    if total == 0:
        lines.extend(["Tidak ada tugas aktif yang perlu ditindaklanjuti hari ini. ✅", ""])
    lines.append(f"Total tugas yang ditampilkan: {total}")
    lines.append("Dikirim otomatis oleh ACTA. Buka ACTA untuk melihat detail dan memperbarui status.")
    return "\n".join(lines)[:16000], total


def _load_tasks(company_id: str, day: date, zone: ZoneInfo) -> tuple[str, list[dict[str, Any]]]:
    client = get_supabase_client()
    companies = client.table("companies").select("name").eq("id", company_id).limit(1).execute().data or []
    company_name = companies[0].get("name", company_id) if companies else company_id
    rows = client.table("action_items").select("*").eq("company_id", company_id).in_("status", ["pending_review", "approved", "in_progress"]).order("created_at", desc=True).limit(300).execute().data or []
    employee_ids = list({str(row.get("selected_owner_id")) for row in rows if row.get("selected_owner_id")})
    employee_names: dict[str, str] = {}
    if employee_ids:
        employees = client.table("employees").select("id,name").in_("id", employee_ids).execute().data or []
        employee_names = {str(row.get("id")): str(row.get("name") or "") for row in employees}
    for row in rows:
        row["selected_owner_name"] = employee_names.get(str(row.get("selected_owner_id") or ""), "")
    return str(company_name), rows


def _safe_zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Invalid timezone. Use an IANA timezone such as Asia/Jakarta.") from exc


def build_telegram_digest_router() -> APIRouter:
    router = APIRouter(prefix="/api/notifications/daily-digest", tags=["telegram-digest"])

    @router.get("/preferences")
    def get_preferences(company_id: str = Query(default=DEFAULT_COMPANY_ID)):
        try:
            rows = get_supabase_client().table("telegram_digest_preferences").select("*").eq("company_id", company_id).limit(1).execute().data or []
            row = rows[0] if rows else None
            if not row:
                return {"configured": bool(_telegram_token() and os.getenv("TELEGRAM_CHAT_ID", "").strip()), "preferences": {
                    "company_id": company_id, "enabled": False, "send_time": "07:00", "timezone_name": DEFAULT_TIMEZONE,
                    "include_overdue": True, "include_due_today": True, "include_due_soon": True,
                    "due_soon_days": 7, "include_pending_review": True,
                    "include_in_progress": True, "include_approved": True,
                }}
            saved_chat_id = str(row.get("chat_id") or "").strip()
            destination = saved_chat_id if saved_chat_id and saved_chat_id != "NOT_CONFIGURED" else os.getenv("TELEGRAM_CHAT_ID", "").strip()
            delivery_configured = bool(_telegram_token() and destination)
            return {"configured": delivery_configured, "preferences": {
                key: row.get(key) for key in ["company_id", "enabled", "send_time", "timezone_name", "include_overdue", "include_due_today", "include_due_soon", "due_soon_days", "include_pending_review", "include_in_progress", "include_approved"]
            }, "destination_configured": bool(destination)}
        except Exception as exc:
            logger.exception("Could not load Telegram digest preferences")
            raise HTTPException(status_code=503, detail="Could not load Telegram digest settings. Apply the calendar/digest migration first.") from exc

    @router.put("/preferences")
    def save_preferences(payload: DigestPreferencesPayload):
        chat_id = (payload.chat_id or os.getenv("TELEGRAM_CHAT_ID", "")).strip()
        if payload.enabled and (not _telegram_token() or not chat_id):
            raise HTTPException(status_code=400, detail="Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the backend before enabling daily digests.")
        _safe_zone(payload.timezone_name)
        row = payload.model_dump(exclude={"chat_id"})
        row["chat_id"] = chat_id or "NOT_CONFIGURED"
        row["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            saved = get_supabase_client().table("telegram_digest_preferences").upsert(row, on_conflict="company_id,chat_id").select("*").execute().data or []
            return {"message": "Daily digest preferences saved.", "preferences": {key: saved[0].get(key) for key in ["company_id", "enabled", "send_time", "timezone_name", "include_overdue", "include_due_today", "include_due_soon", "due_soon_days", "include_pending_review", "include_in_progress", "include_approved"]} if saved else None}
        except Exception as exc:
            logger.exception("Could not save Telegram digest preferences")
            raise HTTPException(status_code=503, detail="Could not save Telegram digest settings.") from exc

    @router.get("/preview")
    def preview_digest(company_id: str = Query(default=DEFAULT_COMPANY_ID), timezone_name: str = Query(default=DEFAULT_TIMEZONE)):
        zone = _safe_zone(timezone_name)
        day = datetime.now(zone).date()
        try:
            company_name, tasks = _load_tasks(company_id, day, zone)
            saved = get_supabase_client().table("telegram_digest_preferences").select("*").eq("company_id", company_id).limit(1).execute().data or []
            prefs = saved[0] if saved else {
                "include_overdue": True, "include_due_today": True, "include_due_soon": True,
                "due_soon_days": 7, "include_pending_review": True,
                "include_in_progress": True, "include_approved": True,
            }
            text, count = _build_digest(company_name, tasks, day, zone, prefs)
            return {"date": day.isoformat(), "task_count": count, "message_preview": text}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Could not generate Telegram digest preview")
            raise HTTPException(status_code=503, detail="Could not generate the daily task recap.") from exc

    @router.get("/runs")
    def list_digest_runs(
        company_id: str = Query(default=DEFAULT_COMPANY_ID, min_length=1, max_length=100),
        limit: int = Query(default=15, ge=1, le=50),
    ):
        try:
            rows = get_supabase_client().table("telegram_digest_runs").select(
                "id,digest_date,status,task_count,error_message,started_at,sent_at,message_id"
            ).eq("company_id", company_id).order("started_at", desc=True).limit(limit).execute().data or []
            return {"data": rows, "count": len(rows)}
        except Exception as exc:
            logger.exception("Could not load Telegram digest run history")
            raise HTTPException(status_code=503, detail="Could not load daily recap history. Apply the calendar/digest migration first.") from exc

    @router.post("/send-test")
    def send_test_digest(company_id: str = Query(default=DEFAULT_COMPANY_ID)):
        rows = get_supabase_client().table("telegram_digest_preferences").select("*").eq("company_id", company_id).limit(1).execute().data or []
        prefs = rows[0] if rows else {}
        chat_id = str(prefs.get("chat_id") or os.getenv("TELEGRAM_CHAT_ID", "")).strip()
        if not chat_id or chat_id == "NOT_CONFIGURED":
            raise HTTPException(status_code=400, detail="Configure the Telegram destination before sending a test digest.")
        zone = _safe_zone(str(prefs.get("timezone_name") or DEFAULT_TIMEZONE))
        day = datetime.now(zone).date()
        company_name, tasks = _load_tasks(company_id, day, zone)
        text, count = _build_digest(company_name, tasks, day, zone, prefs)
        result = _send_telegram("🧪 TEST DIGEST\n\n" + text, chat_id)
        return {"message": "Test daily recap sent.", "task_count": count, "message_ids": result["message_ids"]}

    @router.post("/run-due")
    def run_due_digests(x_acta_cron_secret: str | None = Header(default=None, alias="X-ACTA-CRON-SECRET")):
        expected = os.getenv("ACTA_CRON_SECRET", "").strip()
        if not expected or not x_acta_cron_secret or not hmac.compare_digest(expected, x_acta_cron_secret):
            raise HTTPException(status_code=401, detail="Invalid or missing scheduler authentication.")
        try:
            prefs_rows = get_supabase_client().table("telegram_digest_preferences").select("*").eq("enabled", True).execute().data or []
        except Exception as exc:
            logger.exception("Could not load digest schedule")
            raise HTTPException(status_code=503, detail="Could not load daily digest schedules.") from exc
        results: list[dict[str, Any]] = []
        now_utc = datetime.now(timezone.utc)
        client = get_supabase_client()
        for prefs in prefs_rows:
            run_id = None
            chat_id = str(prefs.get("chat_id") or os.getenv("TELEGRAM_CHAT_ID", "")).strip()
            if not chat_id or chat_id == "NOT_CONFIGURED":
                results.append({"company_id": prefs.get("company_id"), "status": "skipped", "reason": "No Telegram destination configured."})
                continue
            try:
                zone = _safe_zone(str(prefs.get("timezone_name") or DEFAULT_TIMEZONE))
                local_now = now_utc.astimezone(zone)
                send_hour, send_minute = [int(part) for part in str(prefs.get("send_time") or "07:00")[:5].split(":")]
                if (local_now.hour, local_now.minute) < (send_hour, send_minute):
                    continue
                digest_date = local_now.date()
                previous = client.table("telegram_digest_runs").select("id,status,started_at").eq("company_id", prefs["company_id"]).eq("chat_id", chat_id).eq("digest_date", digest_date.isoformat()).limit(1).execute().data or []
                if previous and previous[0].get("status") == "sent":
                    continue
                if previous and previous[0].get("status") == "pending":
                    started = previous[0].get("started_at")
                    try:
                        started_at = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                        if started_at.tzinfo is None:
                            started_at = started_at.replace(tzinfo=timezone.utc)
                        if (now_utc - started_at).total_seconds() < 1800:
                            continue
                    except (TypeError, ValueError):
                        continue
                if previous:
                    run_id = previous[0]["id"]
                    client.table("telegram_digest_runs").update({"status": "pending", "error_message": None, "started_at": now_utc.isoformat()}).eq("id", run_id).execute()
                else:
                    inserted = client.table("telegram_digest_runs").insert({"company_id": prefs["company_id"], "chat_id": chat_id, "digest_date": digest_date.isoformat(), "status": "pending"}).select("id").execute().data or []
                    if not inserted:
                        continue
                    run_id = inserted[0]["id"]
                company_name, tasks = _load_tasks(prefs["company_id"], digest_date, zone)
                text, count = _build_digest(company_name, tasks, digest_date, zone, prefs)
                sent = _send_telegram(text, chat_id)
                client.table("telegram_digest_runs").update({"status": "sent", "task_count": count, "message_id": (sent["message_ids"] or [None])[0], "sent_at": now_utc.isoformat(), "error_message": None}).eq("id", run_id).execute()
                results.append({"company_id": prefs["company_id"], "status": "sent", "task_count": count})
            except Exception as exc:
                logger.exception("Daily digest failed for company %s", prefs.get("company_id"))
                results.append({"company_id": prefs.get("company_id"), "status": "failed", "reason": str(getattr(exc, "detail", "Digest failed."))})
                try:
                    if run_id:
                        client.table("telegram_digest_runs").update({"status": "failed", "error_message": str(getattr(exc, "detail", "Digest failed."))[:500]}).eq("id", run_id).execute()
                except Exception:
                    logger.exception("Could not update failed digest run log")
        return {"processed": len(results), "results": results}

    return router
