"""Read-only, fail-closed schema adoption checks shared by revisions/inspection.

No repairs, stamps, record contents or credentials are printed. Historical
sub-cent amounts remain untouched; nonfinite/negative money needs owner review.
"""
from sqlalchemy import inspect, text, Integer, String, Float, Numeric, Boolean, Date, DateTime
from migrations.legacy_schema import Base

LEGACY = ('users', 'budgets', 'categories', 'expenses', 'shopping_lists', 'shopping_list_items',
          'notifications', 'daily_spending_log', 'category_daily_totals')
MONEY = {'budgets': ['allowance', 'savings_target'], 'categories': ['planned_amount'], 'expenses': ['amount'],
         'shopping_lists': ['total_cost'], 'shopping_list_items': ['amount'],
         'daily_spending_log': ['total_amount'], 'category_daily_totals': ['total_amount']}


def reject(table, reason):
    raise RuntimeError(f'Incompatible schema ({table}): {reason}. No automatic repair or stamp is permitted.')


def validate_history(connection):
    inspector = inspect(connection)
    if inspector.has_table('alembic_version'):
        rows = list(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
        if len(rows) > 1 or any(row not in {'0001_legacy', '0002_item_ledger', '0003_month_allocations'} for row in rows):
            reject('alembic_version', 'unknown or multiple migration heads; preserve and review the existing chain')


def validate_ledger(connection, revision):
    if revision not in {'0002_item_ledger', '0003_month_allocations'}:
        return
    from migrations import item_schema
    names = ['spending_plans', 'planned_items', 'category_preferences', 'purchase_events', 'purchase_lines']
    if revision == '0003_month_allocations':
        from migrations import allocation_schema
        names += ['category_allocations', 'expense_operations']
    inspector = inspect(connection)
    for name in names:
        table = item_schema.Base.metadata.tables[name]
        if not inspector.has_table(name):
            reject(name, 'versioned ledger table is missing')
        columns = {c['name']: c for c in inspector.get_columns(name)}
        for expected in table.columns:
            actual = columns.get(expected.name)
            if actual is None or actual['nullable'] != expected.nullable or not isinstance(actual['type'], type(expected.type)):
                reject(name, 'versioned ledger column differs')
            if isinstance(expected.type, Numeric):
                if (actual['type'].precision, actual['type'].scale) != (expected.type.precision, expected.type.scale):
                    reject(name, 'ledger numeric precision differs')
        unique = {tuple(c['column_names']) for c in inspector.get_unique_constraints(name)}
        unique.update(tuple(i['column_names']) for i in inspector.get_indexes(name) if i['unique'])
        from sqlalchemy import UniqueConstraint, CheckConstraint
        for constraint in table.constraints:
            if isinstance(constraint, UniqueConstraint) and tuple(c.name for c in constraint.columns) not in unique:
                reject(name, 'missing ledger uniqueness')
            if isinstance(constraint, CheckConstraint):
                if constraint.name not in {c['name'] for c in inspector.get_check_constraints(name)}:
                    reject(name, 'missing ledger check constraint')
        actual_fks = inspector.get_foreign_keys(name)
        schema = connection.execute(text('SELECT current_schema()')).scalar() if connection.dialect.name == 'postgresql' else None
        for expected in table.foreign_key_constraints:
            if not any(tuple(fk['constrained_columns']) == tuple(c.name for c in expected.columns)
                       and fk['referred_table'] == expected.referred_table.name
                       and tuple(fk['referred_columns']) == tuple(e.column.name for e in expected.elements)
                       and fk.get('referred_schema') in {None, schema}
                       for fk in actual_fks):
                reject(name, 'missing ledger ownership/reference constraint')
    checks = [
        ('planned_items', 'SELECT count(*) FROM planned_items i JOIN spending_plans p ON i.plan_id=p.id JOIN categories c ON i.category_id=c.id WHERE c.user_id<>p.user_id'),
        ('purchase_events', 'SELECT count(*) FROM purchase_events e JOIN spending_plans p ON e.plan_id=p.id WHERE e.user_id<>p.user_id'),
        ('purchase_lines', '''SELECT count(*) FROM purchase_lines l JOIN purchase_events e ON l.event_id=e.id
            JOIN planned_items i ON l.item_id=i.id JOIN expenses x ON l.expense_id=x.id
            WHERE e.plan_id<>i.plan_id OR e.user_id<>x.user_id OR l.total<>x.amount'''),
        ('category_preferences', 'SELECT count(*) FROM category_preferences p JOIN categories c ON p.category_id=c.id WHERE p.user_id<>c.user_id'),
    ]
    if revision == '0003_month_allocations':
        checks.append(('category_allocations', 'SELECT count(*) FROM category_allocations a JOIN categories c ON a.category_id=c.id WHERE a.user_id<>c.user_id'))
    for table, query in checks:
        if connection.execute(text(query)).scalar():
            reject(table, 'ownership or authoritative-expense reconciliation mismatch')


def validate_legacy(connection, allow_empty=False):
    inspector = inspect(connection)
    present = set(inspector.get_table_names()) & set(LEGACY)
    if not present and allow_empty:
        # Only a truly empty schema can be bootstrapped; foreign application
        # tables are never treated as an empty AllowanceAI database.
        if set(inspector.get_table_names()) - {'alembic_version'}:
            reject('database', 'unexpected tables in an otherwise empty baseline')
        return 'empty'
    if present != set(LEGACY):
        reject('database', 'partial baseline; all legacy tables must be present')
    schema = connection.execute(text('SELECT current_schema()')).scalar() if connection.dialect.name == 'postgresql' else None
    for name in LEGACY:
        table = Base.metadata.tables[name]
        columns = {c['name']: c for c in inspector.get_columns(name)}
        for expected in table.columns:
            actual = columns.get(expected.name)
            if actual is None:
                reject(name, 'missing required column')
            if actual['nullable'] != expected.nullable:
                reject(name, 'column nullability differs')
            compatible = (Float, Numeric) if expected.name in MONEY.get(name, []) else (type(expected.type),)
            if not isinstance(actual['type'], compatible):
                reject(name, 'column type differs')
            if isinstance(expected.type, String) and actual['type'].length is not None:
                if expected.type.length is None or actual['type'].length < expected.type.length:
                    reject(name, 'narrower string column')
        if set(inspector.get_pk_constraint(name)['constrained_columns']) != {c.name for c in table.primary_key}:
            reject(name, 'primary key differs')
        fks = inspector.get_foreign_keys(name)
        for expected in table.foreign_key_constraints:
            matches = [fk for fk in fks if tuple(fk['constrained_columns']) == tuple(c.name for c in expected.columns)
                       and fk['referred_table'] == expected.referred_table.name
                       and tuple(fk['referred_columns']) == tuple(e.column.name for e in expected.elements)
                       and fk.get('referred_schema') in {None, schema}
                       and fk.get('options', {}).get('ondelete', 'NO ACTION') in {'NO ACTION', None}
                       and fk.get('options', {}).get('onupdate', 'NO ACTION') in {'NO ACTION', None}]
            if not matches:
                reject(name, 'missing or unsafe ownership/reference foreign key')
        indexes = inspector.get_indexes(name)
        for expected in table.indexes:
            keys = [c.name for c in expected.columns]
            if not any(i['column_names'] == keys and (not expected.unique or i['unique']) for i in indexes):
                reject(name, 'missing required index or email uniqueness')
        if connection.dialect.name == 'postgresql':
            invalid = connection.execute(text('''SELECT count(*) FROM pg_constraint
                WHERE conrelid = to_regclass(:table) AND contype = 'f' AND NOT convalidated'''), {'table': name}).scalar()
            if invalid:
                reject(name, 'unvalidated foreign key')
            sequence = connection.execute(text("SELECT pg_get_serial_sequence(:table, 'id')"), {'table': name}).scalar()
            if not sequence or not (columns['id'].get('default') or '').startswith('nextval('):
                reject(name, 'missing owned primary-key sequence/default')
            # pg_sequences and sequence state are catalog metadata, never financial contents.
            quoted = connection.dialect.identifier_preparer
            maximum = connection.execute(text(f'SELECT max(id) FROM {quoted.quote(name)}')).scalar()
            seq_names = connection.execute(text('SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=CAST(:sequence AS regclass)'), {'sequence': sequence}).one()
            state, called = connection.exec_driver_sql(f'SELECT last_value,is_called FROM {quoted.quote(seq_names[0])}.{quoted.quote(seq_names[1])}').one()
            if maximum is not None and (state < maximum or (state == maximum and not called)):
                reject(name, 'sequence is behind existing primary keys')
        for column in MONEY.get(name, []):
            if connection.dialect.name == 'postgresql':
                bad = connection.execute(text(f'''SELECT count(*) FROM "{name}" WHERE "{column}" < 0
                    OR lower("{column}"::text) IN ('nan', 'infinity', '-infinity')''')).scalar()
            else:
                bad = connection.execute(text(f'SELECT count(*) FROM "{name}" WHERE "{column}" < 0')).scalar()
            if bad:
                reject(name, 'nonfinite or negative historical money requires explicit review')
    # Case-folded identities are used by authentication even on older exact-case unique indexes.
    if connection.execute(text('SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) q')).scalar():
        reject('users', 'case-insensitive duplicate email identities')
    for name in LEGACY:
        table = Base.metadata.tables[name]
        for fk in table.foreign_keys:
            column, target, target_column = fk.parent.name, fk.column.table.name, fk.column.name
            count = connection.execute(text(f'''SELECT count(*) FROM "{name}" s LEFT JOIN "{target}" t
                ON s."{column}"=t."{target_column}" WHERE s."{column}" IS NOT NULL AND t."{target_column}" IS NULL''')).scalar()
            if count:
                reject(name, 'orphan reference')
    if connection.execute(text('''SELECT count(*) FROM expenses e JOIN categories c ON e.category_id=c.id
        WHERE e.user_id <> c.user_id''')).scalar():
        reject('expenses', 'category ownership mismatch')
    return 'legacy'
