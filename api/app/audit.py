from sqlalchemy.orm import Session

from app.models import AuditEvent


def write_audit(session: Session, event_type: str, actor: str, ip: str | None, upload_id: str | None) -> None:
    session.add(
        AuditEvent(event_type=event_type, actor=actor, ip=ip, upload_id=upload_id)
    )
