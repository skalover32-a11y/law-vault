import time
from datetime import datetime, timezone

from app.audit import write_audit
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Upload, UploadKey, UploadStatus
from app.storage import get_s3_client

settings = get_settings()


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
            session.query(UploadKey).filter(UploadKey.upload_id == upload.id).delete()
            try:
                client.delete_object(Bucket=settings.S3_BUCKET, Key=upload.object_key)
            except Exception:
                pass
            session.delete(upload)
            write_audit(session, "delete", "system", None, str(upload.id))
            session.commit()
        except Exception:
            session.rollback()

    session.close()


def main() -> None:
    while True:
        delete_expired()
        time.sleep(60)


if __name__ == "__main__":
    main()
