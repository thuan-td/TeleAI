"""add kb_documents table with generated tsvector column

Revision ID: c4d8f61a9b02
Revises: b7e2f4a1c8d3
Create Date: 2026-09-24 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID


revision: str = 'c4d8f61a9b02'
down_revision: Union[str, None] = 'b7e2f4a1c8d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kb_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "tokens",
            TSVECTOR,
            sa.Computed(
                "setweight(to_tsvector('simple', title), 'A') || "
                "setweight(to_tsvector('simple', content), 'B')",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_kb_documents_tokens", "kb_documents", ["tokens"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_kb_documents_tokens", table_name="kb_documents")
    op.drop_table("kb_documents")
