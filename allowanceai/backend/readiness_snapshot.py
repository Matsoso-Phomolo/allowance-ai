"""SELECT-only rehearsal evidence. Contains no application writes or migrations.

Run only inside the identity-checked read-only transaction. Output has counts,
digests and financial aggregates, never raw account/password/financial rows.
Keep source evidence privately outside Git. Compare only pre-existing tables
when validating an additive migration; new allocation snapshots are separate.
"""
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from sqlalchemy import MetaData, Table, select, cast, Numeric, Float, func, inspect
from migrations.validation import LEGACY, MONEY


def canonical(value):
    if isinstance(value, Decimal):
        if value == 0:
            return '0'
        rendered = format(value, 'f')
        return rendered.rstrip('0').rstrip('.') if '.' in rendered else rendered
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def capture_snapshot(connection, schema):
    if connection.dialect.name != 'postgresql' or connection.exec_driver_sql('SHOW transaction_read_only').scalar() != 'on':
        raise RuntimeError('Snapshots require an existing PostgreSQL read-only transaction.')
    result = {}
    for name in sorted(inspect(connection).get_table_names(schema=schema)):
        if name not in set(LEGACY) | {'spending_plans', 'planned_items', 'category_preferences',
                                     'purchase_events', 'purchase_lines', 'category_allocations', 'expense_operations'}:
            continue
        table = Table(name, MetaData(), schema=schema, autoload_with=connection)
        # Match PostgreSQL migration's Float -> NUMERIC conversion at the source,
        # rather than introducing Python float formatting differences into hashes.
        columns = [cast(column, Numeric()).label(column.name) if isinstance(column.type, Float) else column for column in table.columns]
        digest = hashlib.sha256()
        count = 0
        for row in connection.execute(select(*columns).order_by(*table.primary_key.columns)).yield_per(500):
            digest.update(json.dumps([canonical(value) for value in row], separators=(',', ':'), sort_keys=True).encode('utf8') + b'\n')
            count += 1
        totals = {}
        for column in MONEY.get(name, []) + ({'purchase_lines': ['total'], 'category_allocations': ['amount']}.get(name, [])):
            if column in table.c:
                totals[column] = canonical(connection.execute(select(func.coalesce(func.sum(cast(table.c[column], Numeric())), 0))).scalar())
        result[name] = {'rows': count, 'sha256': digest.hexdigest(), 'money_totals': totals}
    return result
