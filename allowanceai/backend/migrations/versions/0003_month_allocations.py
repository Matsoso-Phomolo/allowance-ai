"""Snapshot legacy shared limits into explicitly provenance-labeled months.

No source budgets, categories, expenses or purchase history are overwritten.
Historical per-month limits cannot be reconstructed from a shared legacy value;
the copied value is labelled legacy_snapshot, never claimed as original history.
"""
from alembic import op
import sqlalchemy as sa
from datetime import date
from migrations.allocation_schema import CategoryAllocation, ExpenseOperation

revision = '0003_month_allocations'
down_revision = '0002_item_ledger'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    from migrations.validation import validate_legacy
    validate_legacy(connection)
    CategoryAllocation.__table__.create(connection)
    ExpenseOperation.__table__.create(connection)
    # Existing budgets and expense dates define known historical months. Accounts
    # without any dated activity receive only a current-month snapshot.
    months = {}
    for user_id, month in connection.execute(sa.text('SELECT user_id, month FROM budgets')):
        if len(month) != 7:
            raise RuntimeError('Invalid historical budget month; explicit repair required.')
        try:
            parsed = date.fromisoformat(month + '-01')
        except ValueError as exc:
            raise RuntimeError('Invalid historical budget month; explicit repair required.') from exc
        months.setdefault(user_id, set()).add(parsed.strftime('%Y-%m'))
    for user_id, day in connection.execute(sa.text('SELECT DISTINCT user_id, expense_date FROM expenses')):
        month = str(day)[:7]
        months.setdefault(user_id, set()).add(month)
    rows = connection.execute(sa.text('SELECT id, user_id, planned_amount FROM categories')).all()
    for category_id, user_id, amount in rows:
        for month in sorted(months.get(user_id) or {date.today().strftime('%Y-%m')}):
            connection.execute(CategoryAllocation.__table__.insert().values(
                user_id=user_id, category_id=category_id, month=month, amount=amount, origin='legacy_snapshot'))


def downgrade():
    raise RuntimeError('Month allocations cannot be collapsed into shared limits without losing history. Use reviewed forward recovery.')
