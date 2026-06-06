#What it does: Reads environment variables from the .env file and makes them available throughout the app as a single settings object.
#Why we need it: You never hardcode secrets (API keys, database passwords) directly in your Python files. If you push to GitHub, everyone sees them. Instead, secrets live in .env which is listed in .gitignore, so it never gets committed. config.py reads that file and exposes the values safely.

from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str  # ← This should be here
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()