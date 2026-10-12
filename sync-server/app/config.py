from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    secret_key: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./data/sync.db"
    cors_origins: str = "*"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    data_dir: str = "./data"
    host: str = "0.0.0.0"
    port: int = 8000
    # Used for image remoteUri absolute URLs (e.g. https://sync.example.com)
    public_base_url: str = "http://localhost:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def images_dir(self) -> Path:
        path = Path(self.data_dir) / "images"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
