from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str = ""
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768
    nova_profile: str = "general"
    demo_mode: bool = False
    free_daily_limit: int = 10        # free plan: AI messages per visitor per day
    demo_daily_ai_limit: int = 40     # safety net: AI messages per day for the whole demo
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    llm_primary: str = "gemini"


settings = Settings()