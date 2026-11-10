"""Supabase Auth endpoints and company-workspace provisioning."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth_context import get_current_user_id
from app.core.config import settings
from app.db.supabase import get_admin_supabase_client

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class SignupPayload(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    company_name: str | None = Field(default=None, min_length=2, max_length=120)
    invite_code: str | None = Field(default=None, min_length=20, max_length=200)


class LoginPayload(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)


class RefreshPayload(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


def _auth_headers():
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Configure SUPABASE_URL and SUPABASE_ANON_KEY on the backend.")
    return {"apikey": settings.supabase_anon_key, "Content-Type": "application/json"}


def _auth_request(path: str, payload: dict, *, authorization: str | None = None):
    headers = _auth_headers()
    if authorization:
        headers["Authorization"] = f"Bearer {authorization}"
    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/{path}",
            headers=headers, json=payload, timeout=httpx.Timeout(15.0, connect=5.0),
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Supabase Auth.") from exc
    try:
        data = response.json() if response.content else {}
    except ValueError:
        data = {}
    if not response.is_success:
        message = data.get("msg") or data.get("message") or data.get("error_description") or "Supabase Auth request failed."
        status = 409 if response.status_code in (400, 409) and "already" in str(message).lower() else response.status_code
        raise HTTPException(status_code=status if status < 500 else 502, detail=message)
    return data


def _membership_for_user(user_id: str):
    rows = (
        get_admin_supabase_client().table("company_memberships")
        .select("company_id,role,status")
        .eq("user_id", user_id).eq("status", "active").limit(2).execute().data or []
    )
    if not rows:
        raise HTTPException(status_code=403, detail="Your account has no active ACTA workspace membership.")
    if len(rows) > 1:
        raise HTTPException(status_code=409, detail="Your account belongs to multiple workspaces. Contact support.")
    company_rows = get_admin_supabase_client().table("companies").select("id,name,industry,is_fictional_demo_data").eq("id", rows[0]["company_id"]).limit(1).execute().data or []
    return {**rows[0], "company": company_rows[0] if company_rows else None}


def _valid_invitation(invite_code: str, email: str) -> dict | None:
    token_hash = hashlib.sha256(invite_code.strip().encode("utf-8")).hexdigest()
    rows = (
        get_admin_supabase_client().table("company_invitations")
        .select("id,company_id,invited_email,role,status,expires_at")
        .eq("invite_token_hash", token_hash).eq("status", "pending").limit(1).execute().data or []
    )
    if not rows:
        raise HTTPException(status_code=400, detail="Invitation code is invalid, expired, or already used.")
    invite = rows[0]
    expires = datetime.fromisoformat(str(invite["expires_at"]).replace("Z", "+00:00"))
    if expires <= datetime.now(timezone.utc):
        get_admin_supabase_client().table("company_invitations").update({"status": "expired"}).eq("id", invite["id"]).execute()
        raise HTTPException(status_code=400, detail="Invitation code has expired. Ask the workspace owner for a new link.")
    invited_email = str(invite.get("invited_email") or "").strip().lower()
    if invited_email and invited_email != email.lower():
        raise HTTPException(status_code=403, detail="This invitation was issued for a different email address.")
    return invite


def _session_response(data: dict):
    session = data.get("session") or data
    user = data.get("user") or session.get("user") or (data if data.get("id") else {})
    if not user.get("id"):
        raise HTTPException(status_code=502, detail="Supabase Auth did not return a user identity.")
    membership = _membership_for_user(str(user["id"]))
    return {
        "access_token": session.get("access_token"),
        "refresh_token": session.get("refresh_token"),
        "expires_at": session.get("expires_at"),
        "token_type": session.get("token_type", "bearer"),
        "user": {"id": user.get("id"), "email": user.get("email")},
        "membership": membership,
    }


@router.post("/signup")
def signup(payload: SignupPayload):
    email = str(payload.email).lower()
    invitation = _valid_invitation(payload.invite_code, email) if payload.invite_code else None
    if not invitation and not payload.company_name:
        raise HTTPException(status_code=400, detail="Enter a company name or provide a valid invitation code.")

    signup_data = _auth_request("signup", {
        "email": email,
        "password": payload.password,
        "data": {"company_name": (payload.company_name or "").strip()},
    })
    user = signup_data.get("user") or signup_data
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=502, detail="Supabase Auth created no user record.")

    admin = get_admin_supabase_client()
    if invitation:
        company_id = str(invitation["company_id"])
        try:
            admin.table("company_memberships").insert({
                "user_id": str(user_id), "company_id": company_id,
                "role": invitation.get("role") or "member", "status": "active",
            }).execute()
            admin.table("company_invitations").update({
                "status": "accepted", "accepted_by": str(user_id),
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", invitation["id"]).eq("status", "pending").execute()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Your account was created, but joining the invited workspace failed. Contact the workspace owner.") from exc
    else:
        company_id = f"org_{uuid4().hex}"
        company_name = (payload.company_name or "").strip()
        general_division_id = f"division_general_{uuid4().hex[:12]}"
        project_id = f"project_{uuid4().hex}"
        stage = "companies"
        try:
            admin.table("companies").insert({
                "id": company_id, "name": company_name, "industry": "",
                "description": "ACTA workspace created during account registration.",
                "is_fictional_demo_data": False, "schema_version": "1.0.0",
            }).execute()

            stage = "divisions"
            admin.table("divisions").insert({
                "id": general_division_id, "company_id": company_id,
                "name": "General", "description": "Default division for the new ACTA workspace.",
                "responsibilities": [], "keywords": [],
            }).execute()

            stage = "projects"
            admin.table("projects").insert({
                "id": project_id, "company_id": company_id,
                "name": "General Operations", "description": "Starter project for your new ACTA workspace.",
                "status": "active", "project_context_keywords": [],
            }).execute()

            stage = "project_divisions"
            admin.table("project_divisions").insert({
                "project_id": project_id,
                "division_id": general_division_id
            }).execute()

            stage = "company_memberships"
            admin.table("company_memberships").insert({
                "user_id": str(user_id), "company_id": company_id,
                "role": "owner", "status": "active",
            }).execute()

        except Exception:
            logger.exception(
                "Workspace provisioning failed at stage=%s",
                stage
            )

            try:
                admin.table("companies").delete().eq("id", company_id).execute()
            except Exception:
                logger.exception(
                    "Workspace cleanup failed for company_id=%s",
                    company_id
                )

            raise HTTPException(
                status_code=503,
                detail="Your account was created, but workspace provisioning failed. Check the ACTA schema migration or contact support."
            )

    if signup_data.get("access_token") or signup_data.get("session"):
        return {"requires_email_confirmation": False, **_session_response(signup_data)}
    membership = _membership_for_user(str(user_id))
    return {
        "requires_email_confirmation": True,
        "message": "Account created. Check your email to confirm the address, then sign in.",
        "user": {"id": str(user_id), "email": user.get("email")},
        "membership": membership,
    }


class CreateInvitationPayload(BaseModel):
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str = Field(default="member", pattern="^(admin|member)$")
    expires_in_days: int = Field(default=7, ge=1, le=30)


@router.post("/invitations")
def create_invitation(payload: CreateInvitationPayload, request: Request):
    membership = getattr(request.state, "acta_company", None) or {}
    if membership.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only a workspace owner or admin can invite members.")
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
    company_id = str(membership["company_id"])
    try:
        get_admin_supabase_client().table("company_invitations").insert({
            "company_id": company_id, "invite_token_hash": token_hash,
            "invited_email": str(payload.email).lower() if payload.email else None,
            "role": payload.role, "status": "pending", "expires_at": expires.isoformat(),
            "created_by": get_current_user_id(),
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not create an invitation. Apply database/04_auth_multi_tenant_demo.sql.") from exc
    invite_url = f"{settings.acta_frontend_url.rstrip('/')}?invite={raw_token}"
    return {"message": "Workspace invitation created.", "invite_url": invite_url, "invite_code": raw_token, "expires_at": expires.isoformat(), "role": payload.role}


@router.post("/login")
def login(payload: LoginPayload):
    data = _auth_request("token?grant_type=password", {"email": str(payload.email).lower(), "password": payload.password})
    return _session_response(data)


@router.post("/refresh")
def refresh(payload: RefreshPayload):
    data = _auth_request("token?grant_type=refresh_token", {"refresh_token": payload.refresh_token})
    return _session_response(data)


@router.get("/me")
def me(request: Request):
    user = getattr(request.state, "acta_user", None)
    membership = getattr(request.state, "acta_company", None)
    if not user or not membership:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    companies = get_admin_supabase_client().table("companies").select("id,name,industry,is_fictional_demo_data").eq("id", membership["company_id"]).limit(1).execute().data or []
    return {"user": {"id": user.get("id"), "email": user.get("email")}, "membership": {**membership, "company": companies[0] if companies else None}}


@router.post("/logout")
def logout(request: Request):
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        _auth_request("logout", {}, authorization=authorization[7:].strip())
    return {"message": "Signed out."}
