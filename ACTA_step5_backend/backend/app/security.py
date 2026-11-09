"""Authentication middleware for real workspaces and isolated public demo sessions."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

import httpx
from fastapi import Request
from fastapi.responses import JSONResponse

from app.auth_context import reset_request_scope, set_request_scope
from app.core.config import settings
from app.db.supabase import get_admin_supabase_client

logger = logging.getLogger(__name__)

PUBLIC_EXACT_PATHS = {
    "/", "/health", "/docs", "/redoc", "/openapi.json",
    "/api/auth/signup", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout",
    "/api/demo/sessions",
    "/api/integrations/google-calendar/callback",
    "/api/notifications/daily-digest/run-due",
}


def _json_error(status: int, message: str):
    return JSONResponse(status_code=status, content={"detail": message})


async def _verify_supabase_access_token(token: str) -> dict:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.")
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        response = await client.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise ValueError("Access token is invalid or expired.")
    user = response.json()
    if not user.get("id"):
        raise ValueError("Supabase Auth returned no user identity.")
    return user


def install_security_middleware(app):
    @app.middleware("http")
    async def acta_security_middleware(request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path in PUBLIC_EXACT_PATHS:
            return await call_next(request)

        if path.startswith("/api/demo/"):
            demo_token = request.headers.get("x-acta-demo-token") or ""
            if not demo_token:
                auth = request.headers.get("authorization", "")
                if auth.lower().startswith("bearer "):
                    demo_token = auth[7:].strip()
            if not demo_token:
                return _json_error(401, "Start an ACTA demo session first.")
            token_hash = hashlib.sha256(demo_token.encode("utf-8")).hexdigest()
            try:
                rows = (
                    get_admin_supabase_client().table("acta_demo_sessions")
                    .select("id,workspace_state,expires_at,status")
                    .eq("token_hash", token_hash).eq("status", "active")
                    .limit(1).execute().data or []
                )
            except Exception:
                logger.exception("Demo session lookup failed")
                return _json_error(503, "Demo session storage is not ready. Apply the ACTA auth/demo SQL migration.")
            if not rows:
                return _json_error(401, "Demo session is invalid. Start a new demo session.")
            expires = datetime.fromisoformat(str(rows[0]["expires_at"]).replace("Z", "+00:00"))
            if expires <= datetime.now(timezone.utc):
                get_admin_supabase_client().table("acta_demo_sessions").update({"status": "expired"}).eq("id", rows[0]["id"]).execute()
                return _json_error(401, "Demo session expired. Start a new demo session.")
            request.state.acta_mode = "demo"
            request.state.demo_session = rows[0]
            request.state.demo_token_hash = token_hash
            return await call_next(request)

        authorization = request.headers.get("authorization", "")
        if not authorization.lower().startswith("bearer "):
            return _json_error(401, "Sign in to access your ACTA workspace.")
        token = authorization[7:].strip()
        if not token:
            return _json_error(401, "Missing access token.")

        try:
            user = await _verify_supabase_access_token(token)
        except ValueError:
            return _json_error(401, "Your session is invalid or expired. Please sign in again.")
        except Exception:
            logger.exception("Supabase Auth verification failed")
            return _json_error(503, "Could not verify your ACTA session. Check Supabase Auth configuration.")

        try:
            memberships = (
                get_admin_supabase_client().table("company_memberships")
                .select("company_id,role,status")
                .eq("user_id", str(user["id"]))
                .eq("status", "active").limit(2).execute().data or []
            )
        except Exception:
            logger.exception("Company membership lookup failed")
            return _json_error(503, "Could not load your company membership. Apply the ACTA auth/demo SQL migration.")
        if not memberships:
            return _json_error(403, "This account is not linked to an ACTA workspace. Contact your workspace owner.")
        if len(memberships) > 1:
            return _json_error(409, "This account has multiple company memberships. Workspace switching must be configured before continuing.")

        membership = memberships[0]
        request.state.acta_mode = "user"
        request.state.acta_user = user
        request.state.acta_company = membership
        scope_tokens = set_request_scope(
            access_token=token,
            company_id=str(membership["company_id"]),
            user_id=str(user["id"]),
            mode="user",
        )
        try:
            return await call_next(request)
        finally:
            reset_request_scope(scope_tokens)
