"""ACTA native calendar and Google Calendar dual-provider API.

ACTA events are stored in Supabase. Google events are read/written through the
existing OAuth integration. Events created in both calendars carry a private
actaEventId property so ACTA can update/delete the same Google event instead
of creating duplicates.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal
from urllib.parse import quote
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.db.supabase import get_supabase_client
from app.auth_context import current_company_id
from app.deadline_parser import parse_explicit_deadline
from app.integrations import GOOGLE_CALENDAR_API, _google_datetime, _google_request

logger = logging.getLogger(__name__)
DEFAULT_COMPANY_ID = "nova"
DEFAULT_TIMEZONE = "Asia/Jakarta"


class CalendarEventPayload(BaseModel):
    company_id: str = Field(default=DEFAULT_COMPANY_ID, min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=8000)
    start_at: datetime
    end_at: datetime
    timezone_name: str = Field(default=DEFAULT_TIMEZONE, min_length=1, max_length=100)
    all_day: bool = False
    category: str = Field(default="general", max_length=40)
    color: str = Field(default="#4776E6", max_length=20)
    location: str = Field(default="", max_length=500)
    meeting_link: str = Field(default="", max_length=1000)
    recurrence_rule: str | None = Field(default=None, max_length=500)
    linked_entity_type: Literal["meeting", "task"] | None = None
    linked_entity_id: str | None = Field(default=None, max_length=100)
    destination: Literal["acta", "google", "both"] = "acta"

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Event title cannot be empty.")
        return value


def _as_aware(value: datetime, timezone_name: str) -> datetime:
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone. Use an IANA timezone such as Asia/Jakarta.") from exc
    return value.replace(tzinfo=zone) if value.tzinfo is None else value.astimezone(zone)


def _validate_range(payload: CalendarEventPayload) -> tuple[datetime, datetime]:
    start = _as_aware(payload.start_at, payload.timezone_name)
    end = _as_aware(payload.end_at, payload.timezone_name)
    if end <= start:
        raise HTTPException(status_code=400, detail="The event end must be after its start.")
    return start, end


def _google_calendar_id() -> str:
    import os
    return os.getenv("GOOGLE_CALENDAR_ID", "primary").strip() or "primary"


def _google_events_url(calendar_id: str | None = None) -> str:
    return f"{GOOGLE_CALENDAR_API}/calendars/{quote(calendar_id or _google_calendar_id(), safe='')}/events"


def _to_google_resource(payload: CalendarEventPayload, acta_event_id: str | None = None) -> dict[str, Any]:
    start, end = _validate_range(payload)
    if payload.all_day:
        start_value: dict[str, str] = {"date": start.date().isoformat()}
        end_value: dict[str, str] = {"date": end.date().isoformat()}
    else:
        start_value = _google_datetime(start, payload.timezone_name)
        end_value = _google_datetime(end, payload.timezone_name)
    result: dict[str, Any] = {
        "summary": payload.title.strip(),
        "description": payload.description,
        "start": start_value,
        "end": end_value,
    }
    if payload.location:
        result["location"] = payload.location
    if payload.recurrence_rule:
        rule = payload.recurrence_rule.strip()
        result["recurrence"] = [rule if rule.upper().startswith("RRULE:") else f"RRULE:{rule}"]
    private_properties: dict[str, str] = {}
    if acta_event_id:
        private_properties["actaEventId"] = acta_event_id
    if payload.linked_entity_type == "meeting" and payload.linked_entity_id:
        # Keep the legacy key so events created by the old Combined flow can be
        # found and adopted instead of duplicated.
        private_properties["actaMeetingId"] = str(payload.linked_entity_id)
    if private_properties:
        result["extendedProperties"] = {"private": private_properties}
    if payload.meeting_link:
        result["description"] = (payload.description + "\n\nMeeting link: " + payload.meeting_link).strip()
    return result


def _map_google_event(item: dict[str, Any]) -> dict[str, Any]:
    start = item.get("start") or {}
    end = item.get("end") or {}
    private = ((item.get("extendedProperties") or {}).get("private") or {})
    linked_acta_id = private.get("actaEventId")
    return {
        "id": str(linked_acta_id or item.get("id") or ""),
        "google_event_id": item.get("id"),
        "google_calendar_id": _google_calendar_id(),
        "title": item.get("summary") or "(No title)",
        "description": item.get("description") or "",
        "start_at": start.get("dateTime") or start.get("date"),
        "end_at": end.get("dateTime") or end.get("date"),
        "all_day": bool(start.get("date") and not start.get("dateTime")),
        "timezone_name": (start.get("timeZone") or DEFAULT_TIMEZONE),
        "category": "google",
        "color": "#4285F4",
        "location": item.get("location") or "",
        "meeting_link": (item.get("hangoutLink") or ""),
        "recurrence_rule": (item.get("recurrence") or [None])[0],
        "source": "acta" if linked_acta_id else "google",
        "linked_acta_id": linked_acta_id,
        "status": item.get("status", "confirmed"),
        "html_link": item.get("htmlLink"),
    }


def _payload_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "source": "acta",
        "destination": "both" if row.get("google_event_id") else "acta",
    }


def build_calendar_router() -> APIRouter:
    router = APIRouter(prefix="/api/calendar", tags=["calendar"])

    @router.get("/events")
    def list_acta_events(
        start: datetime | None = Query(default=None),
        end: datetime | None = Query(default=None),
        company_id: str = Query(default=DEFAULT_COMPANY_ID, min_length=1, max_length=100),
    ):
        company_id = current_company_id(company_id)
        try:
            query = get_supabase_client().table("calendar_events").select("*").eq("company_id", company_id)
            if start:
                query = query.gt("end_at", start.isoformat())
            if end:
                query = query.lt("start_at", end.isoformat())
            rows = query.order("start_at").limit(1000).execute().data or []
            # Recurring masters are also fetched even when their first occurrence
            # predates the currently visible month/week.
            if start and end:
                recurring_rows = get_supabase_client().table("calendar_events").select("*").eq("company_id", company_id).not_.is_("recurrence_rule", "null").limit(300).execute().data or []
                by_id = {str(row.get("id")): row for row in rows}
                for row in recurring_rows:
                    by_id[str(row.get("id"))] = row
                rows = list(by_id.values())
            output = [_payload_from_row(row) for row in rows]
            # Surface structured task deadlines as read-only all-day calendar entries.
            if start and end:
                client = get_supabase_client()
                base_tasks = client.table("action_items").select(
                    "id,task,deadline_text,deadline_at,status,selected_owner_id,owner_mentioned,project_id"
                ).eq("company_id", company_id).in_("status", ["pending_review", "approved", "in_progress"])
                typed_tasks = base_tasks.gte("deadline_at", start.isoformat()).lt(
                    "deadline_at", end.isoformat()
                ).order("deadline_at").limit(500).execute().data or []
                # Older tasks may have only free-text deadlines. Include them only when
                # the text contains an unambiguous absolute date; never guess "next Friday".
                legacy_tasks = client.table("action_items").select(
                    "id,task,deadline_text,deadline_at,status,selected_owner_id,owner_mentioned,project_id"
                ).eq("company_id", company_id).in_("status", ["pending_review", "approved", "in_progress"]).is_(
                    "deadline_at", "null"
                ).order("created_at", desc=True).limit(500).execute().data or []
                zone = ZoneInfo("Asia/Jakarta")
                start_day = start.astimezone(zone).date() if start.tzinfo else start.replace(tzinfo=zone).date()
                end_day = end.astimezone(zone).date() if end.tzinfo else end.replace(tzinfo=zone).date()
                task_rows = list(typed_tasks)
                known_ids = {str(item.get("id")) for item in task_rows}
                for item in legacy_tasks:
                    parsed = parse_explicit_deadline(item.get("deadline_text"), "Asia/Jakarta")
                    if not parsed:
                        continue
                    due = datetime.fromisoformat(parsed).astimezone(zone)
                    if start_day <= due.date() < end_day and str(item.get("id")) not in known_ids:
                        item["deadline_at"] = parsed
                        task_rows.append(item)
                employee_ids = list({str(item.get("selected_owner_id")) for item in task_rows if item.get("selected_owner_id")})
                employee_names: dict[str, str] = {}
                if employee_ids:
                    employee_rows = get_supabase_client().table("employees").select("id,name").in_("id", employee_ids).execute().data or []
                    employee_names = {str(item.get("id")): str(item.get("name") or "") for item in employee_rows}
                for task in task_rows:
                    due = datetime.fromisoformat(str(task["deadline_at"]).replace("Z", "+00:00"))
                    if due.tzinfo is None:
                        due = due.replace(tzinfo=ZoneInfo("Asia/Jakarta"))
                    due_day = due.astimezone(ZoneInfo("Asia/Jakarta")).date()
                    due_start = due_day.isoformat()
                    due_end = (due_day + timedelta(days=1)).isoformat()
                    owner = employee_names.get(str(task.get("selected_owner_id") or "")) or task.get("owner_mentioned") or "Unassigned"
                    output.append({
                        "id": str(task["id"]), "title": str(task.get("task") or "Task deadline"),
                        "description": f"Task deadline · {owner} · Status: {task.get('status')}",
                        "start_at": due_start, "end_at": due_end, "all_day": True,
                        "timezone_name": "Asia/Jakarta", "category": "task", "color": "#D99A38",
                        "location": "", "meeting_link": "", "recurrence_rule": None,
                        "source": "task", "linked_entity_type": "task", "linked_entity_id": str(task["id"]),
                        "owner_name": owner, "deadline_text": task.get("deadline_text"),
                        "status": task.get("status"), "read_only": True,
                    })
                # Meetings with an explicitly scheduled meeting_date also appear
                # as read-only overlays; meeting content continues to be managed
                # from the Meetings workspace.
                meeting_rows = client.table("meetings").select(
                    "id,title,meeting_date,status,source_type"
                ).eq("company_id", company_id).gte(
                    "meeting_date", start.isoformat()
                ).lt("meeting_date", end.isoformat()).order("meeting_date").limit(500).execute().data or []
                linked_meeting_ids = {
                    str(row.get("linked_entity_id"))
                    for row in rows
                    if row.get("linked_entity_type") == "meeting"
                    and row.get("linked_entity_id")
                }
                for meeting in meeting_rows:
                    if str(meeting.get("id")) in linked_meeting_ids:
                        continue
                    if not meeting.get("meeting_date"):
                        continue
                    meeting_start = datetime.fromisoformat(str(meeting["meeting_date"]).replace("Z", "+00:00"))
                    if meeting_start.tzinfo is None:
                        meeting_start = meeting_start.replace(tzinfo=ZoneInfo("Asia/Jakarta"))
                    meeting_end = meeting_start + timedelta(hours=1)
                    output.append({
                        "id": str(meeting["id"]),
                        "title": str(meeting.get("title") or "ACTA meeting"),
                        "description": f"Meeting · {meeting.get('status') or 'scheduled'}",
                        "start_at": meeting_start.isoformat(),
                        "end_at": meeting_end.isoformat(),
                        "all_day": False,
                        "timezone_name": "Asia/Jakarta",
                        "category": "meeting",
                        "color": "#159B83",
                        "location": "",
                        "meeting_link": "",
                        "recurrence_rule": None,
                        "source": "meeting",
                        "linked_entity_type": "meeting",
                        "linked_entity_id": str(meeting["id"]),
                        "status": meeting.get("status"),
                        "read_only": True,
                    })
            return {"data": output, "count": len(output), "source": "acta"}
        except Exception as exc:
            logger.exception("Failed to load ACTA calendar events")
            raise HTTPException(status_code=503, detail="Could not load ACTA Calendar events. Apply the calendar database migration first.") from exc

    @router.post("/events")
    def create_acta_event(payload: CalendarEventPayload):
        payload.company_id = current_company_id(payload.company_id)
        start, end = _validate_range(payload)
        row = {
            "company_id": payload.company_id,
            "title": payload.title.strip(),
            "description": payload.description,
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "timezone_name": payload.timezone_name,
            "all_day": payload.all_day,
            "category": payload.category,
            "color": payload.color,
            "location": payload.location,
            "meeting_link": payload.meeting_link,
            "recurrence_rule": payload.recurrence_rule,
            "linked_entity_type": payload.linked_entity_type,
            "linked_entity_id": payload.linked_entity_id,
            "sync_status": "pending" if payload.destination == "both" else "acta_only",
        }
        if payload.destination == "google":
            try:
                saved = _google_request("POST", _google_events_url(), json=_to_google_resource(payload)).json()
                return {"message": "Google Calendar event created.", "data": _map_google_event(saved), "source": "google"}
            except HTTPException:
                raise

        client = get_supabase_client()
        try:
            # A retry from Combined must update the calendar row for this meeting,
            # not create another row. Other event types retain normal insert behavior.
            existing_rows = []
            if payload.linked_entity_type == "meeting" and payload.linked_entity_id:
                existing_rows = (
                    client.table("calendar_events").select("*")
                    .eq("company_id", payload.company_id)
                    .eq("linked_entity_type", "meeting")
                    .eq("linked_entity_id", str(payload.linked_entity_id))
                    .limit(1).execute().data or []
                )

            if existing_rows:
                previous = existing_rows[0]
                row["sync_status"] = "pending" if payload.destination == "both" else "acta_only"
                saved_rows = (
                    client.table("calendar_events").update(row)
                    .eq("id", previous["id"]).select("*").execute().data or []
                )
            else:
                saved_rows = client.table("calendar_events").insert(row).select("*").execute().data or []

            if not saved_rows:
                raise RuntimeError("Supabase did not return the saved calendar event.")
            saved_row = saved_rows[0]
        except Exception as exc:
            logger.exception("Failed to save ACTA calendar event")
            raise HTTPException(status_code=503, detail="Could not save the ACTA calendar event.") from exc

        google_html_link = None
        if payload.destination == "both":
            try:
                google_url = _google_events_url(saved_row.get("google_calendar_id"))
                google_event_id = saved_row.get("google_event_id")

                # Adopt events created by the previous /api/integrations/google-calendar/events
                # endpoint (private property actaMeetingId) when no event is linked yet.
                if not google_event_id and payload.linked_entity_type == "meeting" and payload.linked_entity_id:
                    found = _google_request(
                        "GET", google_url,
                        params={
                            "privateExtendedProperty": f"actaMeetingId={payload.linked_entity_id}",
                            "maxResults": 10,
                            "showDeleted": "false",
                        },
                    ).json() or {}
                    existing_google = [
                        item for item in (found.get("items") or [])
                        if item.get("status") != "cancelled"
                    ]
                    if existing_google:
                        google_event_id = existing_google[0].get("id")

                google_resource = _to_google_resource(
                    payload, acta_event_id=str(saved_row["id"])
                )
                if google_event_id:
                    google_saved = _google_request(
                        "PATCH",
                        f"{google_url}/{quote(str(google_event_id), safe='')}",
                        json=google_resource,
                    ).json()
                else:
                    google_saved = _google_request(
                        "POST", google_url, json=google_resource
                    ).json()
                google_html_link = google_saved.get("htmlLink")
                patch = {
                    "google_event_id": google_saved.get("id"),
                    "google_calendar_id": _google_calendar_id(),
                    "sync_status": "synced",
                    "sync_error": None,
                    "updated_at": datetime.now().astimezone().isoformat(),
                }
                update_rows = get_supabase_client().table("calendar_events").update(patch).eq("id", saved_row["id"]).select("*").execute().data or []
                if update_rows:
                    saved_row = update_rows[0]
                else:
                    saved_row.update(patch)
            except Exception as exc:
                logger.warning("ACTA event saved but Google Calendar mirror failed (%s)", type(exc).__name__)
                patch = {"sync_status": "error", "sync_error": "ACTA event saved, but Google Calendar could not be updated."}
                try:
                    get_supabase_client().table("calendar_events").update(patch).eq("id", saved_row["id"]).execute()
                    saved_row.update(patch)
                except Exception:
                    logger.exception("Could not persist Google Calendar sync failure")
                return {"message": "ACTA event saved; Google Calendar sync needs attention.", "data": _payload_from_row(saved_row), "warning": patch["sync_error"]}

        response_data = _payload_from_row(saved_row)
        if google_html_link:
            response_data["htmlLink"] = google_html_link
        return {"message": "Calendar event created successfully.", "data": response_data}

    @router.patch("/events/{event_id}")
    def update_acta_event(event_id: str, payload: CalendarEventPayload):
        start, end = _validate_range(payload)
        client = get_supabase_client()
        try:
            existing = client.table("calendar_events").select("*").eq("id", event_id).limit(1).execute().data or []
        except Exception as exc:
            logger.exception("Could not load ACTA event before update")
            raise HTTPException(status_code=503, detail="Could not load ACTA calendar event.") from exc
        if not existing:
            raise HTTPException(status_code=404, detail="ACTA calendar event not found.")
        old = existing[0]
        changes = {
            "title": payload.title.strip(), "description": payload.description,
            "start_at": start.isoformat(), "end_at": end.isoformat(),
            "timezone_name": payload.timezone_name, "all_day": payload.all_day,
            "category": payload.category, "color": payload.color,
            "location": payload.location, "meeting_link": payload.meeting_link,
            "recurrence_rule": payload.recurrence_rule,
            "linked_entity_type": payload.linked_entity_type,
            "linked_entity_id": payload.linked_entity_id,
            "updated_at": datetime.now().astimezone().isoformat(),
        }
        if old.get("google_event_id"):
            try:
                _google_request(
                    "PATCH",
                    f"{_google_events_url(old.get('google_calendar_id'))}/{quote(str(old['google_event_id']), safe='')}",
                    json=_to_google_resource(payload, acta_event_id=event_id),
                )
                changes.update({"sync_status": "synced", "sync_error": None})
            except Exception as exc:
                logger.warning("ACTA event updated but linked Google event did not (%s)", type(exc).__name__)
                changes.update({"sync_status": "error", "sync_error": "ACTA updated, Google mirror update failed."})
        try:
            rows = client.table("calendar_events").update(changes).eq("id", event_id).select("*").execute().data or []
            if not rows:
                raise RuntimeError("No calendar event returned after update.")
            return {"message": "Calendar event updated.", "data": _payload_from_row(rows[0]), "warning": changes.get("sync_error")}
        except Exception as exc:
            logger.exception("Failed to update ACTA calendar event")
            raise HTTPException(status_code=503, detail="Could not update ACTA calendar event.") from exc

    @router.delete("/events/{event_id}")
    def delete_acta_event(event_id: str):
        client = get_supabase_client()
        rows = client.table("calendar_events").select("*").eq("id", event_id).limit(1).execute().data or []
        if not rows:
            raise HTTPException(status_code=404, detail="ACTA calendar event not found.")
        event = rows[0]
        if event.get("google_event_id"):
            try:
                _google_request(
                    "DELETE",
                    f"{_google_events_url(event.get('google_calendar_id'))}/{quote(str(event['google_event_id']), safe='')}",
                )
            except HTTPException as exc:
                # A remotely deleted Google event is acceptable; other errors are not.
                if "404" not in str(exc.detail):
                    raise
        try:
            client.table("calendar_events").delete().eq("id", event_id).execute()
            return {"message": "Calendar event deleted."}
        except Exception as exc:
            logger.exception("Failed to delete ACTA calendar event")
            raise HTTPException(status_code=503, detail="Could not delete ACTA calendar event.") from exc

    @router.get("/google/events")
    def list_google_events(
        start: datetime = Query(...),
        end: datetime = Query(...),
        show_deleted: bool = False,
    ):
        if end <= start:
            raise HTTPException(status_code=400, detail="Calendar range end must be after start.")
        try:
            response = _google_request(
                "GET", _google_events_url(),
                params={
                    "timeMin": start.isoformat(), "timeMax": end.isoformat(),
                    "singleEvents": "true", "orderBy": "startTime",
                    "maxResults": 2500, "showDeleted": str(show_deleted).lower(),
                },
            )
            items = (response.json() or {}).get("items") or []
            mapped = [_map_google_event(item) for item in items if item.get("status") != "cancelled"]
            return {"data": mapped, "count": len(mapped), "source": "google"}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to list Google Calendar events")
            raise HTTPException(status_code=502, detail="Could not load Google Calendar events.") from exc

    @router.post("/google/events")
    def create_google_event(payload: CalendarEventPayload):
        try:
            saved = _google_request("POST", _google_events_url(), json=_to_google_resource(payload)).json()
            return {"message": "Google Calendar event created.", "data": _map_google_event(saved)}
        except HTTPException:
            raise

    @router.patch("/google/events/{google_event_id}")
    def update_google_event(google_event_id: str, payload: CalendarEventPayload):
        try:
            saved = _google_request(
                "PATCH", f"{_google_events_url()}/{quote(google_event_id, safe='')}",
                json=_to_google_resource(payload),
            ).json()
            return {"message": "Google Calendar event updated.", "data": _map_google_event(saved)}
        except HTTPException:
            raise

    @router.delete("/google/events/{google_event_id}")
    def delete_google_event(google_event_id: str):
        try:
            _google_request("DELETE", f"{_google_events_url()}/{quote(google_event_id, safe='')}")
            return {"message": "Google Calendar event deleted."}
        except HTTPException:
            raise

    @router.post("/google/sync")
    def sync_google_mirrors(start: datetime = Query(...), end: datetime = Query(...)):
        """Pull Google-side changes for ACTA-mirrored events in the visible range."""
        if end <= start:
            raise HTTPException(status_code=400, detail="Calendar range end must be after start.")
        try:
            items = (_google_request(
                "GET", _google_events_url(),
                params={"timeMin": start.isoformat(), "timeMax": end.isoformat(), "singleEvents": "false", "showDeleted": "true", "maxResults": 2500},
            ).json() or {}).get("items") or []
            client = get_supabase_client()
            synced = 0
            seen_linked_ids: set[str] = set()
            for item in items:
                private = ((item.get("extendedProperties") or {}).get("private") or {})
                acta_id = private.get("actaEventId")
                if not acta_id:
                    continue
                seen_linked_ids.add(str(acta_id))
                if item.get("status") == "cancelled":
                    client.table("calendar_events").update({
                        "sync_status": "remote_deleted", "sync_error": "This event was deleted in Google Calendar.",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", acta_id).execute()
                    synced += 1
                    continue
                start_obj, end_obj = item.get("start") or {}, item.get("end") or {}
                start_value = start_obj.get("dateTime") or start_obj.get("date")
                end_value = end_obj.get("dateTime") or end_obj.get("date")
                if not start_value or not end_value:
                    continue
                event_zone = str(start_obj.get("timeZone") or DEFAULT_TIMEZONE)
                all_day = bool(start_obj.get("date") and not start_obj.get("dateTime"))
                # Date-only Google events are stored at local midnight in their calendar timezone.
                if all_day:
                    start_value = _as_aware(datetime.combine(date.fromisoformat(start_value), time.min), event_zone).isoformat()
                    end_value = _as_aware(datetime.combine(date.fromisoformat(end_value), time.min), event_zone).isoformat()
                client.table("calendar_events").update({
                    "title": item.get("summary") or "(No title)",
                    "description": item.get("description") or "",
                    "start_at": start_value,
                    "end_at": end_value,
                    "timezone_name": event_zone,
                    "all_day": all_day,
                    "location": item.get("location") or "",
                    "meeting_link": item.get("hangoutLink") or "",
                    "recurrence_rule": (item.get("recurrence") or [None])[0],
                    "google_event_id": item.get("id"),
                    "google_calendar_id": _google_calendar_id(),
                    "sync_status": "synced", "sync_error": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", acta_id).execute()
                synced += 1
            return {"message": "Google Calendar sync completed.", "updated": synced, "linked_events_seen": len(seen_linked_ids)}
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Google Calendar sync failed")
            raise HTTPException(status_code=502, detail="Could not synchronize Google Calendar changes.") from exc

    return router
