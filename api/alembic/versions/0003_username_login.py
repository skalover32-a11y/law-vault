"""username login

Revision ID: 0003_username_login
Revises: 0002_totp_enable
Create Date: 2026-01-08 01:00:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0003_username_login"
down_revision: Union[str, None] = "0002_totp_enable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("users")}
    indexes = {idx["name"] for idx in inspector.get_indexes("users")}

    if "email" in columns and "username" not in columns:
        op.alter_column("users", "email", new_column_name="username")
        op.alter_column("users", "username", type_=sa.String(length=64))
        if "ix_users_email" in indexes:
            op.drop_index("ix_users_email", table_name="users")
        if "ix_users_username" not in indexes:
            op.create_index("ix_users_username", "users", ["username"], unique=True)
    elif "username" in columns:
        op.alter_column("users", "username", type_=sa.String(length=64))
        if "ix_users_email" in indexes:
            op.drop_index("ix_users_email", table_name="users")
        if "ix_users_username" not in indexes:
            op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.alter_column("users", "username", type_=sa.String(length=255))
    op.alter_column("users", "username", new_column_name="email")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
