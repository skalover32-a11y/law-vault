from datetime import datetime
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9]+$")
    password: str
    totp: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UploadListItem(BaseModel):
    id: str
    orig_name: str
    size_bytes: int
    created_at: datetime
    status: str
    retrieved_at: datetime | None = None
    delete_at: datetime | None = None
    upload_link_label: str | None = None


class UploadListResponse(BaseModel):
    items: list[UploadListItem]


class LinkCreateRequest(BaseModel):
    ttl: str | None = None


class LinkResponse(BaseModel):
    code: str
    url: str
    expires_at: datetime


class TotpStartResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_svg: str
    qr_png: str | None = None


class TotpConfirmRequest(BaseModel):
    code: str


class TotpConfirmResponse(BaseModel):
    status: str


class TotpStatusResponse(BaseModel):
    enabled: bool


class AdminUserItem(BaseModel):
    id: str
    username: str
    totp_enabled: bool
    created_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]


class AdminCreateUserRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9]+$")
    password: str = Field(min_length=8, max_length=128)


class AdminSetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class StatusResponse(BaseModel):
    status: str
