import unittest
from decimal import Decimal
from pathlib import Path
import test_workspace as workspace
import models
import main
import os
from unittest.mock import patch
from database import Base
from sqlalchemy import text, inspect


class ItemMigrationTests(unittest.TestCase):
    setUp = workspace.WorkspaceFinancialTests.setUp
    tearDown = workspace.WorkspaceFinancialTests.tearDown

    def test_upgrade_existing_records_repeatability_and_numeric_storage(self):
        try:
            from alembic import command
            from alembic.config import Config
        except ImportError:
            self.fail('Install requirements-test.txt including Alembic before running migration tests.')
        # This engine is isolated SQLite or a newly created loopback-only test schema.
        Base.metadata.drop_all(self.engine)
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, '0001_legacy')
            connection.execute(text("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (1,'Existing','old@example.invalid','unchanged-hash','user',CURRENT_TIMESTAMP)"))
            connection.execute(text("INSERT INTO budgets (id,user_id,month,allowance,savings_target) VALUES (1,1,'2020-01',1500.25,100.01)"))
            connection.execute(text("INSERT INTO categories (id,user_id,name,planned_amount) VALUES (1,1,'Food',500.125)"))
            connection.execute(text("INSERT INTO expenses (id,user_id,item_name,category_id,amount,expense_date) VALUES (1,1,'Existing expense',1,12.345678901,'2020-01-01')"))
            connection.execute(text("INSERT INTO shopping_lists (id,user_id,name,total_cost,approved,advice,created_at,updated_at) VALUES (1,1,'Existing list',90,false,'original',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            connection.execute(text("INSERT INTO shopping_list_items (id,shopping_list_id,item_name,amount,category_name,created_at) VALUES (1,1,'Rice',90,'Food',CURRENT_TIMESTAMP)"))
            if connection.dialect.name == 'postgresql':
                # A valid historical installation has synchronized owned sequences.
                for name in ['users','budgets','categories','expenses','shopping_lists','shopping_list_items']:
                    connection.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), (SELECT max(id) FROM {name}), true)"))
            command.upgrade(config, 'head')
            command.upgrade(config, 'head')
            self.assertEqual(connection.execute(text('SELECT version_num FROM alembic_version')).scalar(), '0003_month_allocations')
            self.assertEqual(connection.execute(text('SELECT password_hash FROM users')).scalar(), 'unchanged-hash')
            self.assertAlmostEqual(float(connection.execute(text('SELECT amount FROM expenses')).scalar()), 12.345678901, places=9)
            self.assertEqual(float(connection.execute(text('SELECT allowance FROM budgets')).scalar()), 1500.25)
            self.assertEqual(connection.execute(text('SELECT item_name FROM shopping_list_items')).scalar(), 'Rice')
            self.assertEqual(connection.execute(text('SELECT count(*) FROM spending_plans')).scalar(), 0)
            if connection.dialect.name == 'postgresql':
                from sqlalchemy import Numeric
                self.assertIsInstance(next(c['type'] for c in inspect(connection).get_columns('expenses') if c['name'] == 'amount'), Numeric)
        if self.engine.dialect.name == 'postgresql':
            with patch.dict(os.environ, {'ALLOWANCEAI_TEST_CREATE_SCHEMA': '0', 'ALLOWANCEAI_ADMIN_EMAILS': 'old@example.invalid'}):
                main.on_startup()
            with self.sessions() as db:
                self.assertEqual(db.query(models.User).first().role, 'admin')
        # Migration bookkeeping belongs only to this disposable test database/schema.
        with self.engine.begin() as connection:
            connection.execute(text('DROP TABLE alembic_version'))

    def test_empty_database_migration_and_no_seed_records(self):
        from alembic import command
        from alembic.config import Config
        Base.metadata.drop_all(self.engine)
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')
            self.assertEqual(connection.execute(text('SELECT count(*) FROM users')).scalar(), 0)
            self.assertEqual(set(Base.metadata.tables), set(inspect(connection).get_table_names()) - {'alembic_version'})
            connection.execute(text('DROP TABLE alembic_version'))

    def test_postgresql_failed_upgrade_rolls_back_ddl_and_preserves_baseline(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('PostgreSQL transactional DDL cannot be proved by SQLite.')
        from alembic import command
        from alembic.config import Config
        from sqlalchemy.exc import SQLAlchemyError
        Base.metadata.drop_all(self.engine)
        config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, '0001_legacy')
            # Simulate unexpected pre-existing schema; a release must stop safely.
            connection.execute(text('CREATE TABLE planned_items (id INTEGER PRIMARY KEY)'))
        with self.assertRaises(SQLAlchemyError):
            with self.engine.begin() as connection:
                config.attributes['connection'] = connection
                command.upgrade(config, 'head')
        with self.engine.begin() as connection:
            self.assertEqual(connection.execute(text('SELECT version_num FROM alembic_version')).scalar(), '0001_legacy')
            self.assertFalse(inspect(connection).has_table('purchase_events'))
            self.assertFalse(inspect(connection).has_table('spending_plans'))
            connection.execute(text('DROP TABLE planned_items'))
            connection.execute(text('DROP TABLE alembic_version'))
