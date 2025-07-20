"""merge_migration_heads

Revision ID: 3fbdf4642f77
Revises: 002_performance_optimization, add_enhanced_auth_tables, b4666f8be3af
Create Date: 2025-06-21 14:55:14.297779

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fbdf4642f77'
down_revision: Union[str, None] = ('002_performance_optimization', 'add_enhanced_auth_tables', 'b4666f8be3af')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
