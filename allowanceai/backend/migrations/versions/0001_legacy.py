"""Baseline of existing tables. No application rows are seeded or changed."""
from alembic import op
from sqlalchemy import inspect
from migrations.legacy_schema import Base
revision = "0001_legacy"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    from migrations.validation import validate_legacy, LEGACY
    connection = op.get_bind()
    if validate_legacy(connection, allow_empty=True) == 'empty':
        for table in Base.metadata.sorted_tables:
            if table.name in LEGACY:
                table.create(connection)


def downgrade():
    raise RuntimeError("Destructive baseline downgrade is disabled. Restore a reviewed backup if required.")
