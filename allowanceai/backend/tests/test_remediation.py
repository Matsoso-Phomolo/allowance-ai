"""Independent regressions for the audit failures, not implementation mirrors."""
import unittest
from decimal import Decimal
from datetime import date
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import test_workspace as workspace
import test_items as item_tests
import models
import item_models
import item_service
import item_schemas
import schemas
import crud


class RemediationTests(unittest.TestCase):
    setUp = workspace.WorkspaceFinancialTests.setUp
    tearDown = workspace.WorkspaceFinancialTests.tearDown
    register = workspace.WorkspaceFinancialTests.register
    post = workspace.WorkspaceFinancialTests.post
    category = workspace.WorkspaceFinancialTests.category
    plan = item_tests.ItemLedgerTests.plan
    item = item_tests.ItemLedgerTests.item
    add = item_tests.ItemLedgerTests.add
    purchase = item_tests.ItemLedgerTests.purchase

    def test_failed_legacy_create_update_delete_roll_back_sources_and_cache(self):
        h = self.register()
        self.category(h)
        data = {'item_name': 'Audit source', 'amount': '10.00', 'category_name': 'Food', 'operation_key': 'audit-expense-0001'}
        with patch('crud.rebuild_behavior_tracking', side_effect=RuntimeError('injected refresh failure')):
            with self.assertRaises(Exception):
                self.client.post('/api/expenses', headers=h, json=data)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 0)
            self.assertEqual(db.query(models.ExpenseOperation).count(), 0)
        created = self.post('/api/expenses', data, h)
        expense_id = created['expense']['id']
        replay = self.post('/api/expenses', data, h)
        self.assertEqual(replay, created)
        self.post('/api/budget', {'month': self.month, 'allowance': '1000', 'savings_target': '100'}, h)
        response = self.client.get('/api/notifications', headers=h)
        self.assertEqual(response.status_code, 200, response.text)
        with patch('crud.rebuild_behavior_tracking', side_effect=RuntimeError('injected refresh failure')):
            with self.assertRaises(Exception):
                self.client.put(f'/api/expenses/{expense_id}', headers=h, json={**data, 'amount': '20.00'})
            with self.assertRaises(Exception):
                self.client.delete(f'/api/expenses/{expense_id}', headers=h)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 1)
            self.assertEqual(db.query(models.Expense).one().amount, Decimal('10.00'))
            self.assertEqual(db.query(models.DailySpendingLog).one().total_amount, Decimal('10.00'))

    def test_dashboard_reads_after_category_before_any_spending(self):
        h = self.register()
        self.category(h)
        for path in ['/api/alerts', '/api/intelligence', '/api/reports/monthly', '/api/insights/monthly', '/api/notifications']:
            response = self.client.get(path, headers=h)
            self.assertEqual(response.status_code, 200, response.text)

    def test_decimal_contract_and_exact_rejected_inputs(self):
        h = self.register()
        self.category(h)
        for invalid in ['0.015', 'NaN', 'Infinity', '-1', '10000000000000000']:
            response = self.client.post('/api/expenses', headers=h, json={'item_name': 'Invalid', 'amount': invalid, 'category_name': 'Food'})
            self.assertEqual(response.status_code, 422, response.text)
        for amount in ['0.01', '0.02']:
            self.post('/api/expenses', {'item_name': 'Cents', 'amount': amount, 'category_name': 'Food'}, h)
        expenses = self.client.get('/api/expenses', headers=h).json()
        summary = self.client.get('/api/budget', headers=h).json()
        self.assertIsInstance(summary['total_spent'], str)
        self.assertEqual(sum(Decimal(e['amount']) for e in expenses), Decimal(summary['total_spent']))
        # The formerly accepted boundary either stays exact on PostgreSQL or is
        # explicitly unavailable on SQLite, which is not a Decimal storage engine.
        if self.engine.dialect.name == 'postgresql':
            plan = self.add(h, self.plan(h), self.item(quantity='999999', estimated_unit_price='9999999999.99'))
            result = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan, '999999', '9999999999.99'), h)
            value = result['plan']['summary']['actual_expenditure']
            self.assertEqual(value, '9999989999990000.01')
            rows = self.client.get('/api/expenses', headers=h).json()
            report = self.client.get('/api/reports/monthly', headers=h).json()
            self.assertEqual(sum(Decimal(e['amount']) for e in rows), Decimal(report['total_spent']))
            self.assertEqual(Decimal(report['total_spent']), Decimal(value) + Decimal('0.03'))

    def test_historical_subcent_records_are_preserved_and_reconcile_exactly(self):
        h = self.register()
        category = self.category(h)
        with self.sessions() as db:
            user = db.query(models.User).one()
            db.add(models.Expense(user_id=user.id, category_id=category['id'], item_name='Preserved legacy', amount=Decimal('0.015'), expense_date=date.today()))
            db.commit()
        rows = self.client.get('/api/expenses', headers=h).json()
        summary = self.client.get('/api/budget', headers=h).json()
        category_summary = self.client.get('/api/categories', headers=h).json()[0]
        self.assertEqual(Decimal(rows[0]['amount']), Decimal('0.015'))
        self.assertEqual(Decimal(summary['total_spent']), Decimal('0.015'))
        self.assertEqual(Decimal(category_summary['spent_amount']), Decimal('0.015'))

    def test_month_scoping_preserves_current_previous_and_source_values(self):
        h = self.register()
        category = self.category(h, amount=300)
        previous, future = '2020-01', '2027-01'
        self.client.put(f"/api/categories/{category['id']}", headers=h,
                        json={'name': 'Food', 'planned_amount': '200', 'month': previous}).raise_for_status()
        plan = self.post('/api/plans', {'kind': 'monthly', 'name': 'Future only', 'month': future, 'allowance': '1000', 'reserved_savings': '100'}, h)
        plan = self.add(h, plan, self.item(quantity='1', estimated_unit_price='50', category_id=category['id']))
        self.post(f"/api/plans/{plan['id']}/apply-budget", {'version': plan['version']}, h)
        for month, expected in [(self.month, '300'), (previous, '200'), (future, '50')]:
            summary = self.client.get('/api/budget', headers=h, params={'month': month}).json()
            self.assertEqual(Decimal(summary['total_planned']), Decimal(expected))
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 0)
            self.assertEqual(db.query(models.CategoryAllocation).count(), 3)

    def test_same_product_manual_batch_and_recalculation_repeatable(self):
        h = self.register()
        category = self.category(h, 'Pantry', 0)
        plan = self.add(h, self.plan(h), self.item(category_id=category['id']), self.item(category_id=category['id']))
        self.assertEqual(len(plan['items']), 2)
        with self.sessions() as db:
            self.assertEqual(db.query(item_models.CategoryPreference).count(), 1)
            user = db.query(models.User).one()
            for _ in range(3):
                crud.rebuild_behavior_tracking(db, user)
            self.assertEqual(db.query(models.DailySpendingLog).count(), 0)

    def test_cancelled_partial_uses_actual_plus_pending_forecast(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        plan = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan), h)['plan']
        response = self.client.put(f"/api/plans/{plan['id']}/items/{plan['items'][0]['id']}", headers=h,
                                   json={**self.item(), 'version': plan['version'], 'state': 'cancelled'})
        self.assertEqual(response.status_code, 200, response.text)
        summary = response.json()['summary']
        self.assertEqual(summary['expected_remaining'], '835.80')
        self.assertEqual(summary['actual_expenditure'], '64.20')
        self.assertEqual(summary['pending_estimate'], '0.00')

    def test_concurrent_manual_retry_purchase_and_rebuild(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('Actual row-lock concurrency requires PostgreSQL.')
        h = self.register()
        self.category(h)
        plan = self.add(h, self.plan(h))
        with self.sessions() as db:
            user_id = db.query(models.User).one().id
        barrier = Barrier(4)
        def worker(kind):
            with self.sessions() as db:
                user = db.query(models.User).filter_by(id=user_id).one()
                barrier.wait(timeout=10)
                if kind == 'purchase':
                    item_service.confirm_purchase(db, user, plan['id'], item_schemas.PurchaseInput(**self.purchase(plan)))
                elif kind == 'rebuild':
                    crud.rebuild_behavior_tracking(db, user)
                else:
                    crud.add_expense(db, schemas.ExpenseCreate(item_name='Manual', amount='10', category_name='Food', operation_key='concurrent-manual-0001'), user)
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(worker, ['manual', 'manual', 'purchase', 'rebuild']))
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 2)
            self.assertEqual(db.query(models.DailySpendingLog).count(), 1)
            self.assertEqual(db.query(models.DailySpendingLog).one().total_amount, Decimal('74.20'))
            self.assertEqual(db.query(models.CategoryDailyTotal).one().total_amount, Decimal('74.20'))
