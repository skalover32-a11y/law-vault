import os
import tempfile
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.encryption import wrap_key
from app.models import Upload, UploadKey, UploadToken, UploadStatus
from app.storage import get_s3_client
from app.tokens import hash_code, is_valid_code

settings = get_settings()
router = APIRouter(prefix="", tags=["upload"])


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


def validate_token(db: Session, token: str) -> UploadToken:
    if not is_valid_code(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    token_hash = hash_code(token, settings.UPLOAD_TOKEN_SALT)
    now = datetime.now(timezone.utc)
    record = (
        db.query(UploadToken)
        .filter(UploadToken.token_hash == token_hash)
        .one_or_none()
    )
    if not record or record.expires_at < now or record.used_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    return record


@router.post("/api/upload")
def upload_file(
    request: Request,
    files: list[UploadFile] = File(...),
    upload_token: str | None = Header(default=None, alias="X-Upload-Token"),
    db: Session = Depends(get_db),
):
    if not upload_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")

    token_record = validate_token(db, upload_token)

    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing_file")

    for file in files:
        content_type = file.content_type or "application/octet-stream"
        if content_type not in settings.allowed_content_types:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_type")

    client = get_s3_client()
    now = datetime.now(timezone.utc)
    object_keys: list[str] = []

    try:
        for file in files:
            content_type = file.content_type or "application/octet-stream"
            file_key = os.urandom(32)
            content_nonce = os.urandom(12)

            temp_path = None
            size = 0
            content_tag = b""

            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    temp_path = tmp.name
                    encryptor = wrap_encryptor(file_key, content_nonce)
                    while True:
                        chunk = file.file.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > settings.MAX_UPLOAD_SIZE_BYTES:
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="too_large"
                            )
                        tmp.write(encryptor.update(chunk))
                    tmp.write(encryptor.finalize())
                    content_tag = encryptor.tag
            finally:
                file.file.close()

            if size == 0:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")

            object_key = f"upload-{uuid4()}"
            try:
                with open(temp_path, "rb") as payload:
                    client.upload_fileobj(payload, settings.S3_BUCKET, object_key)
            finally:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)

            wrapped_key, key_nonce, key_tag = wrap_key(file_key)
            upload = Upload(
                orig_name=file.filename or "file",
                size_bytes=size,
                content_type=content_type,
                status=UploadStatus.uploaded.value,
                object_key=object_key,
                upload_token_id=token_record.id,
                created_at=now,
            )
            upload_key = UploadKey(
                upload=upload,
                key_wrapped=wrapped_key,
                key_nonce=key_nonce,
                key_tag=key_tag,
                content_nonce=content_nonce,
                content_tag=content_tag,
            )
            db.add(upload)
            db.add(upload_key)
            db.flush()
            write_audit(db, "upload", "sender", get_client_ip(request), str(upload.id))
            object_keys.append(object_key)

        token_record.used_at = now
        db.commit()
    except HTTPException:
        db.rollback()
        for key in object_keys:
            try:
                client.delete_object(Bucket=settings.S3_BUCKET, Key=key)
            except Exception:
                pass
        raise

    return {"status": "ok", "count": len(object_keys)}


def wrap_encryptor(file_key: bytes, content_nonce: bytes):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    return Cipher(algorithms.AES(file_key), modes.GCM(content_nonce)).encryptor()
