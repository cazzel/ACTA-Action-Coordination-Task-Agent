"""Per-request identity and tenant context used by ACTA's Supabase data layer."""
from __future__ import annotations

from contextvars import ContextVar
from typing import Any

_access_token: ContextVar[str | None] = ContextVar("acta_access_token", default=None)
_company_id: ContextVar[str | None] = ContextVar("acta_company_id", default=None)
_user_id: ContextVar[str | None] = ContextVar("acta_user_id", default=None)
_mode: ContextVar[str] = ContextVar("acta_mode", default="system")


def set_request_scope(*, access_token: str | None, company_id: str | None, user_id: str | None, mode: str = "user"):
    return (
        _access_token.set(access_token),
        _company_id.set(company_id),
        _user_id.set(user_id),
        _mode.set(mode),
    )


def reset_request_scope(tokens) -> None:
    _access_token.reset(tokens[0])
    _company_id.reset(tokens[1])
    _user_id.reset(tokens[2])
    _mode.reset(tokens[3])


def get_access_token() -> str | None:
    return _access_token.get()


def get_current_user_id() -> str | None:
    return _user_id.get()


def get_current_mode() -> str:
    return _mode.get()


def current_company_id(requested: str | None = None) -> str:
    """Never trust a caller-supplied tenant ID for an authenticated user."""
    scoped = _company_id.get()
    if scoped:
        return scoped
    value = (requested or "").strip()
    if value:
        return value
    raise RuntimeError("No ACTA company scope is available for this request.")


def current_company_id_or_none() -> str | None:
    return _company_id.get()


def current_user_context() -> dict[str, Any]:
    return {"user_id": _user_id.get(), "company_id": _company_id.get(), "mode": _mode.get()}
