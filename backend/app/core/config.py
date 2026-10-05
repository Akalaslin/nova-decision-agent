from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    embedding_model: str = "gemini-embedding-001"
    gemini_fallback_model: str = ""
    embedding_dim: int = 768

    class Config:
        env_file = ".env"

settings = Settings()