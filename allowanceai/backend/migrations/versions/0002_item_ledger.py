"""Add shared item/purchase ledger and NUMERIC monetary storage, preserving rows."""
from alembic import op
import sqlalchemy as sa
from migrations import item_schema
revision = "0002_item_ledger"
down_revision = "0001_legacy"
branch_labels = None
depends_on = None

MONEY_COLUMNS = {
    "budgets": ["allowance", "savings_target"],
    "categories": ["planned_amount"], "expenses": ["amount"],
    "shopping_lists": ["total_cost"], "shopping_list_items": ["amount"],
    "daily_spending_log": ["total_amount"], "category_daily_totals": ["total_amount"],
}
NEW_TABLES = ["spending_plans", "category_preferences", "planned_items", "purchase_events", "purchase_lines"]

def upgrade():
    connection = op.get_bind()
    from migrations.validation import validate_legacy
    validate_legacy(connection)
    if connection.dialect.name == "postgresql":
        for table, columns in MONEY_COLUMNS.items():
            for column in columns:
                # Unbounded NUMERIC avoids imposing a new rounding scale on historical amounts.
                # Identifiers are static, reviewed revision constants, not user input.
                op.alter_column(table, column, type_=sa.Numeric(), postgresql_using=f'"{column}"::numeric')
    elif connection.dialect.name == "sqlite":
        # SQLite numeric affinity does not provide PostgreSQL precision. Preserve
        # existing tables/FKs instead of rebuilding them merely to change affinity.
        pass
    else:
        raise RuntimeError("Only PostgreSQL and isolated SQLite development databases are supported.")
    for name in NEW_TABLES:
        item_schema.Base.metadata.tables[name].create(connection)

def downgrade():
    raise RuntimeError("Purchase history cannot be dropped automatically. Use a reviewed forward repair or backup recovery.")
