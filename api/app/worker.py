import logging
import time
from datetime import datetime, timezone

from botocore.exceptions import ClientError
from sqlalchemy import func

from app.audit import write_audit
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Upload, UploadKey, UploadStatus, UploadToken
from app.storage import get_s3_client

settings = get_settings()
logger = logging.getLogger(__name__)


def _object_exists(client, bucket: str, object_key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=object_key)
        return True
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", "")).lower()
        if code in {"404", "nosuchkey", "notfound"}:
            return False
        raise


def _delete_object_strict(client, bucket: str, object_key: str) -> None:
    if not _object_exists(client, bucket, object_key):
        logger.warning("Object %s was already absent in bucket %s before cleanup.", object_key, bucket)
        return

    client.delete_object(Bucket=bucket, Key=object_key)
    if _object_exists(client, bucket, object_key):
        raise RuntimeError(f"Object {object_key} still exists after delete request.")


def _delete_orphaned_tokens(session, now: datetime) -> int:
    orphaned_tokens = (
        session.query(UploadToken)
        .outerjoin(Upload, Upload.upload_token_id == UploadToken.id)
        .group_by(UploadToken.id)
        .having(func.count(Upload.id) == 0)
        .filter((UploadToken.used_at.isnot(None)) | (UploadToken.expires_at <= now))
        .all()
    )

    deleted = 0
    for token in orphaned_tokens:
        session.delete(token)
        deleted += 1
    return deleted


def delete_expired() -> None:
    session = SessionLocal()
    now = datetime.now(timezone.utc)
    uploads = (
        session.query(Upload)
        .filter(Upload.status == UploadStatus.retrieved.value)
        .filter(Upload.delete_at <= now)
        .all()
    )

    client = get_s3_client()

    for upload in uploads:
        try:
            token_id = upload.upload_token_id

            session.query(UploadKey).filter(UploadKey.upload_id == upload.id).delete()
            _delete_object_strict(client, settings.S3_BUCKET, upload.object_key)
            session.delete(upload)
            session.flush()

            if token_id:
                has_related_uploads = (
                    session.query(Upload.id)
                    .filter(Upload.upload_token_id == token_id)
                    .first()
                )
                if not has_related_uploads:
                    session.query(UploadToken).filter(UploadToken.id == token_id).delete()

            write_audit(session, "delete", "system", None, str(upload.id))
            session.commit()
            logger.info("Deleted upload %s and its encrypted object.", upload.id)
        except Exception:
            session.rollback()
            logger.exception("Failed to delete upload %s strictly.", upload.id)

    try:
        deleted_tokens = _delete_orphaned_tokens(session, now)
        if deleted_tokens:
            session.commit()
            logger.info("Deleted %s orphaned upload token(s).", deleted_tokens)
    except Exception:
        session.rollback()
        logger.exception("Failed to delete orphaned upload tokens.")

    session.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    while True:
        delete_expired()
        time.sleep(60)


if __name__ == "__main__":
    main()
