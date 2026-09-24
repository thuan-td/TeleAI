"""add lead updated_at, deleted_at and backfill organization_id

Revision ID: a1b2c3d4e5f6
Revises: 152503e4abfb
Create Date: 2026-09-24 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '152503e4abfb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "leads",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Backfill existing rows before enforcing NOT NULL on updated_at.
    op.execute("UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL")
    op.execute(f"UPDATE leads SET organization_id = '{DEFAULT_ORG_ID}'")

    op.alter_column("leads", "updated_at", nullable=False)


def downgrade() -> None:
    op.drop_column("leads", "deleted_at")
    op.drop_column("leads", "updated_at")
