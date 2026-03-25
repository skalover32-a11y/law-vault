"""upload token label and relation

Revision ID: 0004_upload_token_label
Revises: 0003_username_login
Create Date: 2026-01-08 01:30:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0004_upload_token_label"
down_revision: Union[str, None] = "0003_username_login"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("upload_tokens", sa.Column("token_label", sa.String(length=16), nullable=True))
    op.add_column(
        "uploads",
        sa.Column("upload_token_id", sa.Uuid(), sa.ForeignKey("upload_tokens.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("uploads", "upload_token_id")
    op.drop_column("upload_tokens", "token_label")
