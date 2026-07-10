from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    encryption_key: str
    cors_origins_str: str = "http://localhost:5173,http://localhost:3000"
    max_upload_size_mb: int = 50
    live_query_timeout_seconds: int = 20
    live_query_row_limit: int = 200_000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_str.split(",")]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
