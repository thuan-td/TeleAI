"""merge app_settings and lead columns

Revision ID: 2c9fb5de473e
Revises: 9f3b2a7d1c04, a1b2c3d4e5f6
Create Date: 2026-09-24 09:21:16.747865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2c9fb5de473e'
down_revision: Union[str, None] = ('9f3b2a7d1c04', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
