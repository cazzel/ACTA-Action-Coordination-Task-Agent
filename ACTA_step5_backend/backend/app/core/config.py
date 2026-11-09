from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"

    app_env: str = "development"
    acta_demo_session_hours: int = 24
    acta_demo_rate_limit_per_hour: int = 20
    acta_frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
