"""Supabase clients: a privileged server client and a request-scoped RLS client."""
from functools import lru_cache
from supabase import Client, create_client
from app.core.config import settings
from app.auth_context import get_access_token


@lru_cache(maxsize=1)
def get_admin_supabase_client() -> Client:
    """Service-role client. Use only for trusted server tasks (auth bootstrap, demo sessions, cron)."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_client() -> Client:
    """User-scoped PostgREST client so database RLS policies enforce tenant access."""
    token = get_access_token()
    if not token:
        # Used only by explicitly trusted server routes after their own secret/session check.
        return get_admin_supabase_client()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be configured for authenticated requests.")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(token)
    return client
