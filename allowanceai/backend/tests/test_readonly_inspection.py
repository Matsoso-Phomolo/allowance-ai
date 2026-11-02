"""Identity/read-only procedure regressions. No production connections."""
import unittest
from unittest.mock import Mock, patch
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
import test_workspace as workspace
from inspect_schema_readonly import approved_configuration, inspect_readonly
from readiness_snapshot import capture_snapshot, canonical


class InspectionConfigurationTests(unittest.TestCase):
    def configuration(self):
        return dict(DATABASE_URL='postgresql://reader@localhost/neondb',
                    ALLOWANCEAI_INSPECT_HOST='localhost', ALLOWANCEAI_INSPECT_DATABASE='neondb',
                    ALLOWANCEAI_INSPECT_SCHEMA='public', ALLOWANCEAI_INSPECT_ROLE='reader',
                    ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED='localhost|5432|neondb|public|reader')

    def test_missing_or_mismatched_identity_rejected_before_connection(self):
        with self.assertRaises(RuntimeError):
            approved_configuration({})
        config = self.configuration()
        approved_configuration(config)
        for key, value in [('ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED', 'yes'),
                           ('DATABASE_URL', 'postgresql://reader@localhost/other'),
                           ('ALLOWANCEAI_INSPECT_ROLE', 'other')]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                approved_configuration({**config, key: value})

    def test_remote_requires_verified_tls_provider_confirmation_and_direct_host(self):
        config = self.configuration()
        host = 'confirmed.example.neon.tech'
        config.update(DATABASE_URL=f'postgresql://reader@{host}/neondb?sslmode=require',
                      ALLOWANCEAI_INSPECT_HOST=host,
                      ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED=f'{host}|5432|neondb|public|reader')
        with self.assertRaises(RuntimeError):
            approved_configuration(config)
        config['DATABASE_URL'] = config['DATABASE_URL'].replace('sslmode=require', 'sslmode=verify-full')
        with self.assertRaises(RuntimeError):
            approved_configuration(config)
        config['ALLOWANCEAI_INSPECT_NEON_CONFIRMED'] = 'royal-hill-71285700/br-patient-voice-b4tgg6yw'
        approved_configuration(config)
        pooler = host.replace('confirmed', 'confirmed-pooler')
        config.update(DATABASE_URL=config['DATABASE_URL'].replace(host, pooler),
                      ALLOWANCEAI_INSPECT_HOST=pooler,
                      ALLOWANCEAI_INSPECT_IDENTITY_CONFIRMED=f'{pooler}|5432|neondb|public|reader')
        with self.assertRaises(RuntimeError):
            approved_configuration(config)

    def test_actual_identity_mismatch_stops_before_schema_history_inspection(self):
        connection = Mock()
        connection.execute.return_value.one.return_value = ('wrong', 'public', 'reader', ['public'])
        with patch('inspect_schema_readonly.validate_history') as history, self.assertRaises(RuntimeError):
            inspect_readonly(connection, identity=dict(database='neondb', schema='public', role='reader'))
        history.assert_not_called()
        self.assertEqual(canonical(Decimal('123456789012345678901234567890.0100')),
                         '123456789012345678901234567890.01')


class PostgreSQLInspectionTests(unittest.TestCase):
    setUp = workspace.WorkspaceFinancialTests.setUp
    tearDown = workspace.WorkspaceFinancialTests.tearDown
    register = workspace.WorkspaceFinancialTests.register
    post = workspace.WorkspaceFinancialTests.post

    def identity(self):
        with self.engine.connect() as connection:
            database, role = connection.execute(text('SELECT current_database(), current_user')).one()
        return dict(database=database, schema=self.schema, role=role)

    def test_readonly_snapshot_is_repeatable_and_database_rejects_writes(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('Read-only PostgreSQL enforcement requires PostgreSQL.')
        headers = self.register('inspection')
        self.post('/api/categories', dict(name='Food', planned_amount='0'), headers)
        self.post('/api/expenses', dict(item_name='Exact historical', category_name='Food',
                                       amount='12.34', expense_date=self.month + '-02'), headers)
        identity = self.identity()
        with self.engine.connect() as connection:
            with connection.begin():
                result = inspect_readonly(connection, identity=identity)
                self.assertTrue(result['identity_checked'])
                first = capture_snapshot(connection, self.schema)
                self.assertEqual(first, capture_snapshot(connection, self.schema))
                self.assertEqual(first['expenses']['money_totals']['amount'], '12.34')
                self.assertNotIn('inspection@example.invalid', str(first))
                with self.assertRaises(DBAPIError):
                    connection.exec_driver_sql("UPDATE expenses SET amount=0")
        with self.engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql('SELECT amount FROM expenses').scalar(), Decimal('12.34'))

    def test_legacy_snapshot_matches_after_complete_migration(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('Snapshot precision requires PostgreSQL.')
        from pathlib import Path
        from alembic.config import Config
        from alembic import command
        from database import Base
        Base.metadata.drop_all(self.engine)
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, '0001_legacy')
            connection.exec_driver_sql("INSERT INTO users(name,email,password_hash,role,created_at) VALUES('Legacy','old@example.invalid','original','user',CURRENT_TIMESTAMP)")
            connection.exec_driver_sql("INSERT INTO categories(user_id,name,planned_amount) VALUES(1,'Food',300.125)")
            connection.exec_driver_sql("INSERT INTO expenses(user_id,item_name,category_id,amount,expense_date) VALUES(1,'Old',1,0.015,'2020-01-02')")
        try:
            identity = self.identity()
            with self.engine.begin() as connection:
                inspect_readonly(connection, identity=identity)
                before = capture_snapshot(connection, self.schema)
            with self.engine.begin() as connection:
                config.attributes['connection'] = connection
                command.upgrade(config, 'head')
            with self.engine.begin() as connection:
                result = inspect_readonly(connection, identity=identity)
                self.assertEqual(result['revisions'], ['0003_month_allocations'])
                after = capture_snapshot(connection, self.schema)
            for name, snapshot in before.items():
                self.assertEqual(snapshot, after[name], name)
        finally:
            with self.engine.begin() as connection:
                connection.exec_driver_sql('DROP TABLE alembic_version')
