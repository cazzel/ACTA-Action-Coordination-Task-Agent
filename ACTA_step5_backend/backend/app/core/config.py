from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Supabase is required when the API first accesses the database.
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # OpenRouter is used by the meeting/action coordination agent.
    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"

    app_env: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
