"""
Central configuration. Every value can be overridden by an environment
variable of the same name (case-insensitive), which is how Railway / Render
inject secrets at deploy time.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Postgres connection string, e.g.
    # postgresql://user:password@host:5432/bakaaya
    database_url: str = "postgresql://postgres:postgres@localhost:5432/bakaaya"

    # Secret used to sign JWTs. MUST be overridden in production.
    secret_key: str = "change-this-secret-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Groq API key for the AI chat layer (free tier at console.groq.com)
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # Comma-separated list of origins allowed to call this API
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
