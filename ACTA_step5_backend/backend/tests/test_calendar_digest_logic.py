"""Focused, offline tests for the Calendar deadline and Telegram digest logic."""
from __future__ import annotations

import sys
import types
from datetime import date
from zoneinfo import ZoneInfo

# The production requirements install Supabase. The lightweight build/test
# container may not; stub only its client factory because these unit tests do
# not access a database.
try:
    import supabase  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - used only in stripped CI images
    module = types.ModuleType("supabase")
    module.Client = object
    module.create_client = lambda *args, **kwargs: None
    sys.modules["supabase"] = module

from app.deadline_parser import parse_explicit_deadline
from app.telegram_digest import _build_digest


def test_deadline_parser_accepts_explicit_dates_and_rejects_relative_phrases():
    assert parse_explicit_deadline("2026-11-10").startswith("2026-11-10T09:00:00")
    assert parse_explicit_deadline("10/11/2026").startswith("2026-11-10T09:00:00")
    assert parse_explicit_deadline("next Friday") is None
    assert parse_explicit_deadline("end of next week") is None


def test_daily_digest_groups_overdue_today_due_soon_and_statuses():
    zone = ZoneInfo("Asia/Jakarta")
    tasks = [
        {"task": "Late", "status": "in_progress", "deadline_at": "2026-11-04T09:00:00+07:00"},
        {"task": "Today", "status": "approved", "deadline_at": "2026-11-06T09:00:00+07:00"},
        {"task": "Soon", "status": "approved", "deadline_at": "2026-11-10T09:00:00+07:00"},
        {"task": "Review", "status": "pending_review"},
        {"task": "Working", "status": "in_progress"},
    ]
    prefs = {
        "include_overdue": True, "include_due_today": True, "include_due_soon": True,
        "due_soon_days": 7, "include_pending_review": True,
        "include_in_progress": True, "include_approved": True,
    }
    message, count = _build_digest("NOVA", tasks, date(2026, 11, 6), zone, prefs)
    assert count == 5
    assert "OVERDUE (1)" in message
    assert "DUE TODAY (1)" in message
    assert "DUE IN THE NEXT 7 DAYS (1)" in message
    assert "WAITING FOR APPROVAL (1)" in message
    assert "IN PROGRESS (1)" in message
