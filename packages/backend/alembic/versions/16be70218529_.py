"""empty message

Revision ID: 16be70218529
Revises: 003_add_dataset_versioning, 3fbdf4642f77
Create Date: 2025-07-10 23:19:10.070226

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16be70218529'
down_revision: Union[str, None] = ('003_add_dataset_versioning', '3fbdf4642f77')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
