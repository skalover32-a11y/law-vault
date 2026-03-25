"""totp enable

Revision ID: 0002_totp_enable
Revises: 0001_init
Create Date: 2026-01-08 00:30:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0002_totp_enable"
down_revision: Union[str, None] = "0001_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.alter_column("users", "totp_secret", nullable=True)
    op.execute("UPDATE users SET totp_enabled = true WHERE totp_secret IS NOT NULL")


def downgrade() -> None:
    op.alter_column("users", "totp_secret", nullable=False)
    op.drop_column("users", "totp_enabled")
