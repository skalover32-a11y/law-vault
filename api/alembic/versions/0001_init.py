"""init

Revision ID: 0001_init
Revises: 
Create Date: 2026-01-08 00:00:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0001_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("totp_secret", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "upload_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token_label", sa.String(length=16), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_upload_tokens_hash", "upload_tokens", ["token_hash"], unique=True)

    op.create_table(
        "uploads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("orig_name", sa.String(length=512), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, index=True),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("upload_token_id", sa.Uuid(), sa.ForeignKey("upload_tokens.id", ondelete="SET NULL"), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delete_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_uploads_object_key", "uploads", ["object_key"], unique=True)

    op.create_table(
        "upload_keys",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("upload_id", sa.Uuid(), sa.ForeignKey("uploads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_wrapped", sa.LargeBinary(), nullable=False),
        sa.Column("key_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_tag", sa.LargeBinary(), nullable=False),
        sa.Column("content_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("content_tag", sa.LargeBinary(), nullable=False),
    )
    op.create_index("ix_upload_keys_upload_id", "upload_keys", ["upload_id"], unique=True)

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=32), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("upload_id", sa.Uuid(), sa.ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("upload_keys")
    op.drop_index("ix_uploads_object_key", table_name="uploads")
    op.drop_table("uploads")
    op.drop_index("ix_upload_tokens_hash", table_name="upload_tokens")
    op.drop_table("upload_tokens")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
