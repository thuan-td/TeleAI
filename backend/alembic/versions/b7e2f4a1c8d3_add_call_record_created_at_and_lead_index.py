"""add call_records.created_at and index on lead_id

Revision ID: b7e2f4a1c8d3
Revises: 2c9fb5de473e
Create Date: 2026-09-24 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e2f4a1c8d3'
down_revision: Union[str, None] = '2c9fb5de473e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_records",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE call_records SET created_at = COALESCE(started_at, now())")
    op.alter_column("call_records", "created_at", nullable=False)

    op.create_index("ix_call_records_lead_id", "call_records", ["lead_id"])


def downgrade() -> None:
    op.drop_index("ix_call_records_lead_id", table_name="call_records")
    op.drop_column("call_records", "created_at")
