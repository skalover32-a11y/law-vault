from datetime import datetime, timezone, timedelta
from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.encryption import unwrap_key
from app.models import Upload, UploadStatus, UploadKey, UploadToken, User
from app.schemas import (
    UploadListResponse,
    UploadListItem,
    LinkResponse,
    LinkCreateRequest,
    TotpStartResponse,
    TotpConfirmRequest,
    TotpConfirmResponse,
    TotpStatusResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminCreateUserRequest,
    AdminSetPasswordRequest,
    StatusResponse,
)
from app.security import decode_token, hash_password
from app.storage import get_s3_client
import base64
import io
import pyotp
import qrcode
import qrcode.image.svg
from app.tokens import generate_code, hash_code, label_from_code, parse_ttl

settings = get_settings()
router = APIRouter(prefix="/portal", tags=["portal"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_current_user(request: Request, db: Session) -> User:
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")
    token = auth.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    user = db.query(User).filter(User.id == payload.get("sub")).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    return user


def require_admin(request: Request, db: Session) -> User:
    user = get_current_user(request, db)
    if user.username not in settings.admin_usernames:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return user


@router.get("/files", response_model=UploadListResponse)
def list_files(request: Request, db: Session = Depends(get_db)):
    get_current_user(request, db)
    items = (
        db.query(Upload, UploadToken)
        .outerjoin(UploadToken, Upload.upload_token_id == UploadToken.id)
        .filter(Upload.status.in_([UploadStatus.uploaded.value, UploadStatus.retrieved.value]))
        .order_by(Upload.created_at.desc())
        .all()
    )
    return UploadListResponse(
        items=[
            UploadListItem(
                id=str(upload.id),
                orig_name=upload.orig_name,
                size_bytes=upload.size_bytes,
                created_at=upload.created_at,
                status=upload.status,
                retrieved_at=upload.retrieved_at,
                delete_at=upload.delete_at,
                upload_link_label=token.token_label if token else None,
            )
            for upload, token in items
        ]
    )


@router.post("/links", response_model=LinkResponse)
def create_link(request: Request, payload: LinkCreateRequest | None = None, db: Session = Depends(get_db)):
    get_current_user(request, db)

    ttl_value = settings.UPLOAD_TOKEN_TTL_DEFAULT
    if payload and payload.ttl:
        ttl_value = payload.ttl

    try:
        ttl = parse_ttl(ttl_value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_ttl")

    now = datetime.now(timezone.utc)
    expires_at = now + ttl

    for _ in range(5):
        code = generate_code()
        token_hash = hash_code(code, settings.UPLOAD_TOKEN_SALT)
        exists = db.query(UploadToken).filter(UploadToken.token_hash == token_hash).one_or_none()
        if exists:
            continue
        record = UploadToken(
            token_hash=token_hash,
            token_label=label_from_code(code),
            expires_at=expires_at,
        )
        db.add(record)
        write_audit(db, "link_created", "portal", get_client_ip(request), None)
        db.commit()
        base = str(request.base_url).rstrip("/")
        url = f"{base}/send/{code}"
        return LinkResponse(code=code, url=url, expires_at=expires_at)

    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="link_generation_failed")


@router.post("/totp/start", response_model=TotpStartResponse)
def totp_start(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if user.totp_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_enabled")

    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_enabled = False
    db.commit()

    totp = pyotp.TOTP(secret, issuer=settings.TOTP_ISSUER)
    otpauth_url = totp.provisioning_uri(name=user.username)
    qr_svg = ""
    qr_png = None
    try:
        qr = qrcode.make(otpauth_url, image_factory=qrcode.image.svg.SvgImage)
        qr_svg = qr.to_string().decode("utf-8")
        qr_svg = qr_svg.replace('<?xml version="1.0" encoding="UTF-8"?>', "").strip()
    except Exception:
        qr_svg = ""

    try:
        img = qrcode.make(otpauth_url)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_png = base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:
        qr_png = None

    return TotpStartResponse(
        secret=secret,
        otpauth_url=otpauth_url,
        qr_svg=qr_svg,
        qr_png=qr_png,
    )


@router.post("/totp/confirm", response_model=TotpConfirmResponse)
def totp_confirm(payload: TotpConfirmRequest, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if user.totp_enabled:
        return TotpConfirmResponse(status="enabled")

    totp = pyotp.TOTP(user.totp_secret, issuer=settings.TOTP_ISSUER)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_code")

    user.totp_enabled = True
    db.commit()
    return TotpConfirmResponse(status="enabled")


@router.get("/totp/status", response_model=TotpStatusResponse)
def totp_status(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return TotpStatusResponse(enabled=bool(user.totp_enabled))


@router.get("/admin/users", response_model=AdminUserListResponse)
def admin_list_users(request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    users = db.query(User).order_by(User.created_at.asc()).all()
    return AdminUserListResponse(
        items=[
            AdminUserItem(
                id=str(user.id),
                username=user.username,
                totp_enabled=user.totp_enabled,
                created_at=user.created_at,
            )
            for user in users
        ]
    )


@router.post("/admin/users", response_model=StatusResponse)
def admin_create_user(payload: AdminCreateUserRequest, request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    existing = db.query(User).filter(User.username == payload.username).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="login_exists")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        totp_secret=None,
        totp_enabled=False,
    )
    db.add(user)
    write_audit(db, "admin_user_created", "portal", get_client_ip(request), None)
    db.commit()
    return StatusResponse(status="created")


@router.post("/admin/users/{user_id}/password", response_model=StatusResponse)
def admin_set_password(user_id: str, payload: AdminSetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    user = db.query(User).filter(User.id == user_uuid).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    user.password_hash = hash_password(payload.password)
    write_audit(db, "admin_password_changed", "portal", get_client_ip(request), None)
    db.commit()
    return StatusResponse(status="password_updated")


@router.post("/admin/users/{user_id}/disable-totp", response_model=StatusResponse)
def admin_disable_totp(user_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request, db)
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    user = db.query(User).filter(User.id == user_uuid).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    user.totp_secret = None
    user.totp_enabled = False
    write_audit(db, "admin_totp_disabled", "portal", get_client_ip(request), None)
    db.commit()
    return StatusResponse(status="totp_disabled")


class DownloadStreamer:
    def __init__(self, object_body, file_key: bytes, content_nonce: bytes, content_tag: bytes, size_bytes: int,
                 upload_id, client_ip: str | None):
        self.object_body = object_body
        self.decryptor = self._make_decryptor(file_key, content_nonce, content_tag)
        self.size_bytes = size_bytes
        self.bytes_sent = 0
        self.upload_id = upload_id
        self.client_ip = client_ip

    def _make_decryptor(self, file_key: bytes, nonce: bytes, tag: bytes):
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

        return Cipher(algorithms.AES(file_key), modes.GCM(nonce, tag)).decryptor()

    def __iter__(self):
        session = SessionLocal()
        success = False
        try:
            while True:
                chunk = self.object_body.read(1024 * 1024)
                if not chunk:
                    break
                data = self.decryptor.update(chunk)
                self.bytes_sent += len(data)
                yield data
            tail = self.decryptor.finalize()
            if tail:
                self.bytes_sent += len(tail)
                yield tail
            success = self.bytes_sent == self.size_bytes
        except Exception:
            success = False
            raise
        finally:
            try:
                self.object_body.close()
            except Exception:
                pass
            if success:
                now = datetime.now(timezone.utc)
                delete_at = now + timedelta(seconds=settings.RETENTION_AFTER_RETRIEVAL_SECONDS)
                upload = session.query(Upload).filter(Upload.id == self.upload_id).one_or_none()
                if upload and upload.status == UploadStatus.uploaded.value:
                    upload.status = UploadStatus.retrieved.value
                    upload.retrieved_at = now
                    upload.delete_at = delete_at
                    write_audit(session, "download_finished", "portal", self.client_ip, str(upload.id))
                    session.commit()
            session.close()


@router.get("/files/{upload_id}/download")
def download_file(upload_id: str, request: Request, db: Session = Depends(get_db)):
    get_current_user(request, db)

    try:
        upload_uuid = UUID(upload_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    upload = db.query(Upload).filter(Upload.id == upload_uuid).one_or_none()
    if not upload or upload.status != UploadStatus.uploaded.value:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="not_available")

    upload_key = db.query(UploadKey).filter(UploadKey.upload_id == upload_uuid).one_or_none()
    if not upload_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="missing_key")

    file_key = unwrap_key(upload_key.key_wrapped, upload_key.key_nonce, upload_key.key_tag)

    client = get_s3_client()
    try:
        obj = client.get_object(Bucket=settings.S3_BUCKET, Key=upload.object_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="missing_object")

    write_audit(db, "download_started", "portal", get_client_ip(request), str(upload.id))
    db.commit()

    streamer = DownloadStreamer(
        obj["Body"],
        file_key,
        upload_key.content_nonce,
        upload_key.content_tag,
        upload.size_bytes,
        upload_id=upload.id,
        client_ip=get_client_ip(request),
    )

    filename = upload.orig_name or "file"
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"

    return StreamingResponse(
        streamer,
        media_type=upload.content_type,
        headers={"Content-Disposition": disposition},
    )
