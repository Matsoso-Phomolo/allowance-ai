"""Fail-closed adoption and preservation tests using only disposable schemas."""
from pathlib import Path
from decimal import Decimal
from datetime import date
import unittest
from sqlalchemy import text
from alembic import command
from alembic.config import Config
import test_workspace as workspace
from database import Base


class AdoptionTests(unittest.TestCase):
    setUp = workspace.WorkspaceFinancialTests.setUp
    register = workspace.WorkspaceFinancialTests.register
    post = workspace.WorkspaceFinancialTests.post
    def tearDown(self):
        self.clear_revision()
        workspace.WorkspaceFinancialTests.tearDown(self)

    def baseline(self):
        Base.metadata.drop_all(self.engine)
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, '0001_legacy')
        return config

    def clear_revision(self):
        # Cleanup is confined to this fixture's in-memory DB/UUID local schema.
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE IF EXISTS alembic_version')

    def upgrade(self, config):
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')

    def test_missing_email_uniqueness_rejected_before_stamp(self):
        config = self.baseline()
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE alembic_version')
            connection.exec_driver_sql('DROP INDEX ix_users_email')
        with self.assertRaisesRegex(RuntimeError, 'uniqueness'):
            self.upgrade(config)

    def test_partial_legacy_schema_not_treated_as_clean_install(self):
        config = self.baseline()
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE alembic_version')
            connection.exec_driver_sql('DROP TABLE notifications')
        with self.assertRaisesRegex(RuntimeError, 'partial baseline'):
            self.upgrade(config)

    def test_unknown_and_multiple_heads_rejected_without_rewriting_history(self):
        config = self.baseline()
        with self.engine.begin() as connection:
            connection.exec_driver_sql("UPDATE alembic_version SET version_num='external_history'")
        with self.assertRaisesRegex(RuntimeError, 'unknown or multiple'):
            self.upgrade(config)

        with self.engine.begin() as connection:
            self.assertEqual(connection.exec_driver_sql('SELECT version_num FROM alembic_version').scalar(), 'external_history')
            connection.exec_driver_sql("UPDATE alembic_version SET version_num='0001_legacy'")
            connection.exec_driver_sql("INSERT INTO alembic_version VALUES ('0002_item_ledger')")
        with self.assertRaisesRegex(RuntimeError, 'unknown or multiple'):
            self.upgrade(config)

    def test_already_stamped_head_does_not_hide_schema_drift(self):
        config = self.baseline()
        self.upgrade(config)
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP INDEX ix_users_email')
        with self.assertRaisesRegex(RuntimeError, 'uniqueness'):
            self.upgrade(config)

    def test_populated_unversioned_schema_snapshots_known_months_without_rewriting_sources(self):
        config = self.baseline()
        with self.engine.begin() as connection:
            connection.exec_driver_sql('DROP TABLE alembic_version')
            connection.exec_driver_sql("INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(1,'Legacy','legacy@example.invalid','original','user',CURRENT_TIMESTAMP)")
            connection.exec_driver_sql("INSERT INTO budgets(id,user_id,month,allowance,savings_target) VALUES(1,1,'2020-01',1000,100),(2,1,'2020-02',750,50)")
            connection.exec_driver_sql("INSERT INTO categories(id,user_id,name,planned_amount) VALUES(1,1,'Food',300.125)")
            connection.exec_driver_sql("INSERT INTO expenses(id,user_id,item_name,category_id,amount,expense_date) VALUES(1,1,'Historical',1,0.015,'2020-01-02')")
            if connection.dialect.name == 'postgresql':
                for name in ['users', 'budgets', 'categories', 'expenses']:
                    connection.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}','id'),(SELECT max(id) FROM {name}),true)"))
        self.upgrade(config)
        self.upgrade(config)
        with self.engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql('SELECT password_hash FROM users').scalar(), 'original')
            self.assertEqual(Decimal(str(connection.exec_driver_sql('SELECT amount FROM expenses').scalar())), Decimal('0.015'))
            self.assertEqual(Decimal(str(connection.exec_driver_sql('SELECT planned_amount FROM categories').scalar())), Decimal('300.125'))
            rows = connection.exec_driver_sql('SELECT month,origin FROM category_allocations ORDER BY month').all()
            self.assertEqual(rows, [('2020-01', 'legacy_snapshot'), ('2020-02', 'legacy_snapshot')])
        # Exercise the API against the migrated schema, not an ORM-created copy.
        headers = self.register('migrated-user')
        plan = self.post('/api/plans', {'kind': 'shopping', 'name': 'Migrated workflow', 'month': self.month,
                                       'allowance': '100', 'reserved_savings': '0'}, headers)
        plan = self.post(f"/api/plans/{plan['id']}/items", {'version': plan['version'],
                         'items': [{'item_name': 'Rice', 'quantity': '3', 'estimated_unit_price': '30'}]}, headers)
        result = self.post(f"/api/plans/{plan['id']}/purchases", {'version': plan['version'],
                           'idempotency_key': 'migration-workflow-001', 'purchase_date': str(date.today()),
                           'items': [{'item_id': plan['items'][0]['id'], 'quantity': '2', 'actual_unit_price': '32.10'}]}, headers)
        self.assertEqual(result['plan']['summary']['actual_expenditure'], '64.20')
        self.assertEqual(result['plan']['items'][0]['remaining_quantity'], '1.000')
        with self.engine.connect() as connection:
            original = connection.exec_driver_sql('SELECT amount FROM expenses WHERE id=1').scalar()
            self.assertEqual(Decimal(str(original)), Decimal('0.015'))

    def test_postgres_null_ownership_foreign_key_sequence_and_type_drift_rejected(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('PostgreSQL catalog/ALTER checks require PostgreSQL.')
        config = self.baseline()
        # Roll back each intentional drift after validating it was rejected.
        variants = [
            ('ALTER TABLE users ALTER COLUMN email DROP NOT NULL', 'nullability'),
            ('ALTER TABLE categories ALTER COLUMN user_id DROP NOT NULL', 'nullability'),
            ('ALTER TABLE expenses DROP CONSTRAINT expenses_user_id_fkey', 'foreign key'),
            ('ALTER TABLE budgets ALTER COLUMN month TYPE INTEGER USING 0', 'type differs'),
            ('ALTER TABLE categories ALTER COLUMN id DROP DEFAULT', 'sequence/default'),
        ]
        from migrations.validation import validate_legacy
        for sql, expected in variants:
            with self.subTest(sql=sql):
                with self.engine.connect() as connection:
                    transaction = connection.begin()
                    try:
                        connection.exec_driver_sql(sql)
                        with self.assertRaisesRegex(RuntimeError, expected):
                            validate_legacy(connection)
                    finally:
                        transaction.rollback()
