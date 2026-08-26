"""Configuration via pydantic-settings — all from env vars."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration — loaded from env vars / .env file."""

    # ── Auth ────────────────────────────────────────────────
    mc_api_key: str = Field(default="", description="API key for /api/* endpoints")

    # ── CORS ────────────────────────────────────────────────
    cors_origins: list[str] = Field(default=["http://localhost:5200"])

    # ── Rate Limiting ───────────────────────────────────────
    rate_limit_rpm: int = Field(
        default=60, description="Max requests per minute per IP"
    )

    # ── Database ────────────────────────────────────────────
    database_url: str = Field(default="sqlite+aiosqlite:///data/mission_control.db")

    # ── Hermes ──────────────────────────────────────────────
    hermes_home: str = Field(default="/Volumes/HermesAgent/HermesAgentUSB/data")
    telegram_bot_token: str = Field(
        default="", description="Telegram bot token dari @BotFather"
    )
    telegram_chat_id: str = Field(default="")

    # ── Paths ───────────────────────────────────────────────
    data_dir: Path = Field(default=Path("data"))
    logs_dir: Path = Field(default=Path("logs"))

    # ── Debug ───────────────────────────────────────────────
    debug: bool = Field(default=False)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
