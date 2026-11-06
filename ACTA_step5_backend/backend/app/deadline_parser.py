"""Conservative parser for explicit date deadlines in meeting-derived tasks.

Ambiguous relative phrases (e.g. 'next Friday') are deliberately left unset;
users can still see the original deadline_text and correct it in ACTA.
"""
from __future__ import annotations

import re
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

_MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11,
    "december": 12, "dec": 12,
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5,
    "juni": 6, "juli": 7, "agustus": 8, "september": 9, "oktober": 10,
    "november": 11, "desember": 12,
}


def parse_explicit_deadline(value: object, timezone_name: str = "Asia/Jakarta") -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().lower()
    parsed: date | None = None
    try:
        match = re.search(r"(?<!\d)(20\d{2})-(\d{1,2})-(\d{1,2})(?!\d)", text)
        if match:
            parsed = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        if parsed is None:
            match = re.search(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](20\d{2})(?!\d)", text)
            if match:
                # Numeric Indonesian dates are interpreted as DD/MM/YYYY.
                parsed = date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
        if parsed is None:
            match = re.search(r"(?<!\d)(\d{1,2})\s+([a-z]+)\s+(20\d{2})(?!\d)", text)
            if match and match.group(2) in _MONTHS:
                parsed = date(int(match.group(3)), _MONTHS[match.group(2)], int(match.group(1)))
        if parsed is None:
            match = re.search(r"(?<!\d)([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})(?!\d)", text)
            if match and match.group(1) in _MONTHS:
                parsed = date(int(match.group(3)), _MONTHS[match.group(1)], int(match.group(2)))
    except ValueError:
        return None
    if parsed is None:
        return None
    # Use a defined local morning rather than assuming midnight UTC.
    local = datetime.combine(parsed, time(9, 0), tzinfo=ZoneInfo(timezone_name))
    return local.isoformat()
