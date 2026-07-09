from functools import lru_cache

from supabase import Client, create_client

from config import get_settings

settings = get_settings()


@lru_cache
def get_service_client() -> Client:
    """Service-role client. Bypasses RLS - the backend enforces ownership itself."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache
def get_anon_client() -> Client:
    """Anon-key client, used only to validate user access tokens against GoTrue."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)
