import base64
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    DATABASE_URL: str
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET: str = "uploads"

    APP_MASTER_KEY_B64: str
    JWT_SECRET: str
    TOTP_ISSUER: str = "Portal"
    ADMIN_USERNAMES: str = "admin"
    RETENTION_AFTER_RETRIEVAL_SECONDS: int = 600
    UPLOAD_TOKEN_SALT: str = ""
    UPLOAD_TOKEN_TTL_DEFAULT: str = "24h"
    MAX_UPLOAD_SIZE_BYTES: int = 1_073_741_824
    ALLOWED_CONTENT_TYPES: str = (
        "application/pdf,application/zip,application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
        "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,"
        "application/rtf,text/rtf,text/plain,text/csv,application/json,"
        "application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,"
        "application/vnd.oasis.opendocument.presentation,"
        "image/png,image/jpeg,image/gif,application/octet-stream"
    )

    ACCESS_TOKEN_EXPIRES_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRES_DAYS: int = 7

    @property
    def master_key(self) -> bytes:
        return base64.b64decode(self.APP_MASTER_KEY_B64)

    @property
    def allowed_content_types(self) -> set[str]:
        return {item.strip() for item in self.ALLOWED_CONTENT_TYPES.split(",") if item.strip()}

    @property
    def admin_usernames(self) -> set[str]:
        return {item.strip() for item in self.ADMIN_USERNAMES.split(",") if item.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
