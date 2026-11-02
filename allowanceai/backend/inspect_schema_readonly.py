"""Explicit read-only production preflight. Never runs migrations or prints secrets.

Run only with the intended securely injected DATABASE_URL. Does not load .env.
The caller must verify the project/database identity through its authorized
provider connection; SELECT 1 or a hostname is not proof of that identity.
"""
import os
import json
import argparse
from sqlalchemy.engine import make_url
from sqlalchemy import create_engine, text, inspect
from migrations.validation import validate_history, validate_legacy, validate_ledger


def verify_identity(connection, *, database, schema, role):
    """Identity checks precede all application-table/history queries."""
    row = connection.execute(text(
        'SELECT current_database(), current_schema(), current_user, current_schemas(false)'
    )).one()
    if tuple(row[:3]) != (database, schema, role) or list(row[3]) != [schema]:
        raise RuntimeError('Unexpected database/schema/role/search path; inspection stopped.')


def inspect_readonly(connection, *, identity):
    connection.exec_driver_sql('SET TRANSACTION READ ONLY')
    connection.exec_driver_sql("SET LOCAL statement_timeout = '15s'")
    connection.exec_driver_sql("SET LOCAL lock_timeout = '3s'")
    verify_identity(connection, **identity)
    # Resolve the intended schema before looking up its migration bookkeeping.
    inspector = inspect(connection)
    tables = inspector.get_table_names(schema=identity['schema'])
    validate_history(connection)
    shape = validate_legacy(connection, allow_empty=True)
    inspector = inspect(connection)
    revisions = list(connection.execute(text('SELECT version_num FROM alembic_version')).scalars()) if inspector.has_table('alembic_version') else []
    if revisions:
        validate_ledger(connection, revisions[0])
    return {'read_only': True, 'schema_shape': shape, 'revisions': revisions,
            'baseline_compatible': True, 'deployment_ready': False,
            'table_count': len(tables), 'identity_checked': True,
            'note': 'Provider identity mapping, restore rehearsal and release verification are separate gates.'}


def approved_configuration(environ):
    """Fail before connect unless the operator has confirmed a precise identity.

    Expected values come from authorized provider metadata, never from guessing
    the supplied URL. The confirmation is an operator assertion, not provider proof.
    """
    required = ('DATABASE_URL', 'ALLOWANCEAI_INSPECT_HOST', 'ALLOWANCEAI_INSPECT_DATABASE',
                'ALLOWANCEAI_INSPECT_SCHEMA', 'ALLOWANCEAI_INSPECT_ROLE',
                'ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED')
    if any(not environ.get(key) for key in required):
        raise RuntimeError('Secure connection and independently confirmed identity are required.')
    url = make_url(environ['DATABASE_URL'])
    expected = {key: environ['ALLOWANCEAI_INSPECT_' + key.upper()] for key in ('database', 'schema', 'role')}
    host = environ['ALLOWANCEAI_INSPECT_HOST']
    confirmation = '|'.join((host, str(url.port or 5432), expected['database'], expected['schema'], expected['role']))
    if environ['ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED'] != confirmation:
        raise RuntimeError('Explicit identity confirmation does not match.')
    if (url.get_backend_name() != 'postgresql' or url.host != host or
            url.database != expected['database'] or url.username != expected['role']):
        raise RuntimeError('Connection does not match the independently confirmed identity.')
    if '-pooler' in host:
        raise RuntimeError('Inspection requires the approved direct endpoint.')
    if host not in {'localhost', '127.0.0.1', '::1'}:
        if url.query.get('sslmode') not in {'verify-ca', 'verify-full'}:
            raise RuntimeError('Remote inspection requires certificate-verified TLS.')
        if environ.get('ALLOWANCEAI_INSPECT_NEON_CONFIRMED') != 'royal-hill-71285700/br-patient-voice-b4tgg6yw':
            raise RuntimeError('Confirm the intended Neon project/branch via authorized provider metadata first.')
    return url, expected


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', action='store_true', help='Include aggregate/digest evidence; redirect to protected storage outside Git.')
    arguments = parser.parse_args()
    engine = None
    try:
        url, identity = approved_configuration(os.environ)
        engine = create_engine(url, hide_parameters=True, isolation_level='REPEATABLE READ',
                               connect_args={'connect_timeout': 10, 'options': '-c default_transaction_read_only=on'})
        with engine.connect() as connection:
            with connection.begin():
                result = inspect_readonly(connection, identity=identity)
                if arguments.snapshot:
                    from readiness_snapshot import capture_snapshot
                    result['snapshot'] = capture_snapshot(connection, identity['schema'])
        print(json.dumps(result))
    except Exception:
        # Driver exceptions can contain endpoint/role/SQL details; do not emit them.
        raise SystemExit('Read-only inspection failed or found incompatible history/schema. Review securely with the database owner; no changes were applied.') from None
    finally:
        if engine is not None:
            engine.dispose()
