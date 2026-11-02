"""Isolated API/ledger tests. PostgreSQL uses only the guarded local test schemas."""
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from unittest.mock import patch
import test_workspace as workspace
import models
import item_models as im
import item_service
import item_schemas
import category_engine


class ItemLedgerTests(workspace.ExactFinancialAssertions, unittest.TestCase):
    setUp = workspace.WorkspaceFinancialTests.setUp
    tearDown = workspace.WorkspaceFinancialTests.tearDown
    register = workspace.WorkspaceFinancialTests.register
    post = workspace.WorkspaceFinancialTests.post
    category = workspace.WorkspaceFinancialTests.category
    summary = workspace.WorkspaceFinancialTests.summary

    def plan(self, headers, kind='shopping'):
        return self.post('/api/plans', {'kind': kind, 'name': 'October purchases', 'month': self.month,
                                       'allowance': '1000.00', 'reserved_savings': '100.00'}, headers)

    def item(self, name='Rice', **changes):
        return {'item_name': name, 'package_size': '2.5', 'measurement_unit': 'kg', 'package_type': 'bag',
                'quantity': '3', 'estimated_unit_price': '30.00', **changes}

    def add(self, headers, plan, *items):
        return self.post(f"/api/plans/{plan['id']}/items", {'version': plan['version'], 'items': items or [self.item()]}, headers)

    def purchase(self, plan, quantity='2', price='32.10', key='confirm-rice-001', rows=None, day=None):
        return {'version': plan['version'], 'idempotency_key': key, 'purchase_date': day or str(date.today()),
                'items': rows or [{'item_id': plan['items'][0]['id'], 'quantity': quantity, 'actual_unit_price': price}]}

    def test_decimal_package_quantity_and_fractional_units(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        self.assertEqual(plan['items'][0]['planned_total'], '90.00')
        self.assertEqual(plan['summary']['expected_remaining'], '810.00')
        loose = self.item('Beans', package_size='1', package_type='loose', quantity='0.125', estimated_unit_price='0.12')
        plan = self.add(h, plan, loose)
        self.assertEqual(plan['items'][-1]['planned_total'], '0.02')  # half-up, not binary float/bankers rounding
        response = self.client.post(f"/api/plans/{plan['id']}/items", headers=h,
                                    json={'version': plan['version'], 'items': [self.item(quantity='1.5')]})
        self.assertEqual(response.status_code, 422)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 0)
            self.assertEqual(db.query(models.Category).first().planned_amount, 0)

    def test_category_correction_preferences_ambiguity_and_isolation(self):
        h = self.register()
        plan = self.add(h, self.plan(h), self.item('Mystery box'))
        self.assertIsNone(plan['items'][0]['category_id'])
        cat = self.category(h, 'Pantry', 0)
        item = plan['items'][0]
        updated = self.client.put(f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                                  json={**self.item('Mystery box', category_id=cat['id']), 'version': plan['version']})
        self.assertEqual(updated.status_code, 200, updated.text)
        suggestion = self.post('/api/items/suggest-category', {'item_name': 'Mystery box'}, h)
        self.assertEqual(suggestion['category_id'], cat['id'])
        self.assertEqual(suggestion['source'], 'confirmed_preference')
        bob = self.register('bob')
        self.assertIsNone(self.post('/api/items/suggest-category', {'item_name': 'Mystery box'}, bob)['category_id'])
        self.assertEqual(self.post('/api/items/suggest-category', {'item_name': 'Rice and soap'}, h)['confidence'], 'needs_review')
        self.assertEqual(self.post('/api/items/suggest-category', {'item_name': 'Mokhatlo contribution'}, h)['category_name'], 'Mokhatlo')

    def test_existing_categories_reused_and_manual_selection_preserved(self):
        h = self.register()
        food = self.category(h, 'Food', 0)
        plan = self.add(h, self.plan(h))
        self.assertEqual(plan['items'][0]['category_id'], food['id'])
        custom = self.category(h, 'Special purchases', 0)
        plan = self.add(h, plan, self.item('Soap', category_id=custom['id']))
        item = plan['items'][-1]
        result = self.client.put(f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                                 json={**self.item('Soap', estimated_unit_price='40'), 'version': plan['version']})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['items'][-1]['category_id'], custom['id'])

    def test_partial_purchase_multiple_dates_prices_and_reconciliation(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        payload = self.purchase(plan, day=f'{self.month}-01')
        preview = self.post(f"/api/plans/{plan['id']}/purchase-preview", payload, h)
        self.assertEqual(preview['total'], '64.20')
        self.assertEqual(self.summary(h)['total_spent'], 0)
        result = self.post(f"/api/plans/{plan['id']}/purchases", payload, h)
        plan = result['plan']
        self.assertEqual(plan['items'][0]['remaining_quantity'], '1.000')
        self.assertEqual(plan['items'][0]['status'], 'partial')
        self.assertEqual(self.summary(h)['total_spent'], 64.2)
        result = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan, '1', '29.95', 'second-date-001'), h)
        plan = result['plan']
        self.assertEqual(plan['summary']['actual_expenditure'], '94.15')
        self.assertEqual(plan['summary']['purchased_price_variance'], '4.15')
        self.assertEqual(plan['items'][0]['status'], 'purchased')
        self.assertEqual(len(plan['purchases']), 2)
        self.assertEqual(self.summary(h)['total_spent'], 94.15)
        self.assertEqual(self.client.get('/api/reports/monthly', headers=h).status_code, 200)
        with self.sessions() as db:
            self.assertEqual(db.query(im.PurchaseLine).count(), db.query(models.Expense).count())

    def test_repeated_confirmation_and_conflicting_key(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        payload = self.purchase(plan)
        first = self.post(f"/api/plans/{plan['id']}/purchases", payload, h)
        replay = self.post(f"/api/plans/{plan['id']}/purchases", payload, h)
        self.assertTrue(replay['replayed'])
        self.assertEqual(first['event_id'], replay['event_id'])
        conflict = {**payload, 'items': [{**payload['items'][0], 'actual_unit_price': '1'}]}
        self.assertEqual(self.client.post(f"/api/plans/{plan['id']}/purchases", json=conflict, headers=h).status_code, 409)
        self.assertEqual(self.summary(h)['total_spent'], 64.2)

    def test_100_item_list_only_65_confirmed_remaining_35(self):
        h = self.register()
        plan = self.add(h, self.plan(h), *[self.item(f'Rice {index}', quantity='1') for index in range(100)])
        rows = [{'item_id': item['id'], 'quantity': '1', 'actual_unit_price': '29.99'} for item in plan['items'][:65]]
        plan = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan, rows=rows), h)['plan']
        self.assertEqual(sum(Decimal(item['remaining_quantity']) for item in plan['items']), 35)
        self.assertEqual(plan['summary']['actual_expenditure'], '1949.35')
        self.assertEqual(plan['summary']['pending_estimate'], '1050.00')
        self.assertTrue(plan['summary']['over_allocated'])
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 65)
            self.assertEqual(db.query(models.Category).count(), 1)

    def test_transaction_rollback_including_expenses_and_derived_logs(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        with patch('crud.rebuild_behavior_tracking', side_effect=RuntimeError('test failure')):
            with self.assertRaises(Exception):
                self.client.post(f"/api/plans/{plan['id']}/purchases", json=self.purchase(plan), headers=h)
        with self.sessions() as db:
            for table in [models.Expense, im.PurchaseEvent, im.PurchaseLine, models.DailySpendingLog]:
                self.assertEqual(db.query(table).count(), 0)
            self.assertEqual(db.query(im.SpendingPlan).first().version, plan['version'])

    def test_cross_user_plan_item_category_and_confirmation_denied(self):
        a, b = self.register(), self.register('bob')
        pa, pb = self.add(a, self.plan(a)), self.add(b, self.plan(b))
        self.assertEqual(self.client.get(f"/api/plans/{pa['id']}", headers=b).status_code, 404)
        self.assertEqual(self.client.post(f"/api/plans/{pa['id']}/purchases", json=self.purchase(pa), headers=b).status_code, 404)
        self.assertEqual(self.client.post(f"/api/plans/{pb['id']}/purchases", json=self.purchase(pa), headers=b).status_code, 404)
        self.assertEqual(self.client.post(f"/api/plans/{pb['id']}/items", headers=b,
                                          json={'version': pb['version'], 'items': [self.item(category_id=pa['items'][0]['category_id'])]}).status_code, 404)

    def test_apply_budget_only_on_explicit_action_and_preserve_other_allocations(self):
        h = self.register()
        self.category(h, 'Rent', 200)
        plan = self.add(h, self.plan(h, 'monthly'))
        self.assertFalse(self.summary(h)['configured'])
        self.assertEqual(self.summary(h)['total_planned'], 200)
        applied = self.post(f"/api/plans/{plan['id']}/apply-budget", {'version': plan['version']}, h)
        summary = self.summary(h)
        self.assertEqual(summary['total_planned'], 290)
        self.assertEqual(summary['savings_target'], 100)
        self.assertEqual(summary['total_spent'], 0)
        self.post(f"/api/plans/{plan['id']}/apply-budget", {'version': applied['plan']['version']}, h)
        self.assertEqual(self.summary(h)['total_planned'], 290)  # replace, never add twice

    def test_skip_cancel_reopen_reorder_and_purchase_audit_immutability(self):
        h = self.register()
        plan = self.add(h, self.plan(h), self.item(), self.item('Soap'))
        item = plan['items'][0]
        plan = self.client.put(f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                               json={**self.item(state='skipped'), 'version': plan['version']}).json()
        self.assertEqual(self.client.post(f"/api/plans/{plan['id']}/purchases", json=self.purchase(plan), headers=h).status_code, 409)
        plan = self.client.put(f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                               json={**self.item(), 'version': plan['version']}).json()
        plan = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan), h)['plan']
        expense_id = plan['purchases'][0]['items'][0]['expense_id']
        self.assertEqual(self.client.delete(f'/api/expenses/{expense_id}', headers=h).status_code, 409)
        # DELETE bodies use request() in this httpx version.
        self.assertEqual(self.client.request('DELETE', f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                                              json={'version': plan['version']}).status_code, 409)
        order = [row['id'] for row in reversed(plan['items'])]
        plan = self.post(f"/api/plans/{plan['id']}/reorder", {'version': plan['version'], 'item_ids': order}, h)
        self.assertEqual([row['id'] for row in plan['items']], order)

    def test_legacy_import_is_explicit_idempotent_and_preserves_original(self):
        h = self.register()
        self.category(h, 'Food', 0)
        old = self.post('/api/shopping-lists', {'name': 'Old list', 'items': [{'item_name': 'Rice', 'amount': 90, 'category_name': 'Food'}]}, h)
        plan = self.post(f"/api/shopping-lists/{old['id']}/import-items", {}, h)
        again = self.post(f"/api/shopping-lists/{old['id']}/import-items", {}, h)
        self.assertEqual(plan['id'], again['id'])
        self.assertEqual(plan['items'][0]['quantity'], '1.000')
        self.assertEqual(plan['items'][0]['planned_total'], '90.00')
        self.assertEqual(self.client.get('/api/shopping-lists', headers=h).json()[0]['items'][0]['amount'], 90)
        self.assertEqual(self.summary(h)['total_spent'], 0)

    def test_concurrent_same_key_and_distinct_keys_serialize(self):
        if self.engine.dialect.name != 'postgresql':
            self.skipTest('Real row-lock concurrency is verified on local PostgreSQL, not SQLite.')
        h = self.register()
        plan = self.add(h, self.plan(h))
        def run(payload):
            with self.sessions() as db:
                user = db.query(models.User).first()
                try:
                    return item_service.confirm_purchase(db, user, plan['id'], item_schemas.PurchaseInput(**payload))
                except Exception as exc:
                    return getattr(exc, 'status_code', str(exc))
        payload = self.purchase(plan)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(run, [payload, payload]))
        self.assertEqual(sorted(r['replayed'] for r in results), [False, True])
        with self.sessions() as db:
            self.assertEqual(db.query(models.Expense).count(), 1)
        plan = self.client.get(f"/api/plans/{plan['id']}", headers=h).json()
        p1 = self.purchase(plan, '1', key='concurrent-key-A')
        p2 = self.purchase(plan, '1', key='concurrent-key-B')
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(run, [p1, p2]))
        self.assertEqual(sum(isinstance(r, dict) for r in results), 1)
        self.assertIn(409, results)
        self.assertEqual(self.summary(h)['total_spent'], 96.3)

    def test_untrusted_totals_stale_edits_and_overpurchase_rejected(self):
        h = self.register()
        plan = self.add(h, self.plan(h))
        payload = self.purchase(plan, quantity='4')
        self.assertEqual(self.client.post(f"/api/plans/{plan['id']}/purchases", json=payload, headers=h).status_code, 409)
        payload = {**self.purchase(plan), 'total': '0.01'}
        self.assertEqual(self.client.post(f"/api/plans/{plan['id']}/purchases", json=payload, headers=h).status_code, 422)
        self.assertEqual(self.client.post(f"/api/plans/{plan['id']}/items", headers=h,
                                          json={'version': plan['version'] - 1, 'items': [self.item('Soap')]}).status_code, 409)
        confirmed = self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan), h)['plan']
        item = confirmed['items'][0]
        self.assertEqual(self.client.put(f"/api/plans/{plan['id']}/items/{item['id']}", headers=h,
                                         json={**self.item(quantity='1'), 'version': confirmed['version']}).status_code, 409)
        expense_id = confirmed['purchases'][0]['items'][0]['expense_id']
        self.assertEqual(self.client.put(f'/api/expenses/{expense_id}', headers=h,
                                         json={'item_name': 'Rice', 'amount': 1, 'category_name': item['category_name']}).status_code, 409)
        self.assertEqual(self.summary(h)['total_spent'], 64.2)

    def test_account_export_and_explicit_deletion_include_ledger(self):
        h = self.register()
        other = self.register('bob')
        plan = self.add(h, self.plan(h))
        self.post(f"/api/plans/{plan['id']}/purchases", self.purchase(plan), h)
        exported = self.client.get('/api/account/export', headers=h)
        self.assertEqual(exported.status_code, 200, exported.text)
        self.assertEqual(len(exported.json()['item_plans'][0]['purchases']), 1)
        deleted = self.client.delete('/api/account', headers=h)
        self.assertEqual(deleted.status_code, 200, deleted.text)
        with self.sessions() as db:
            for table in [im.PurchaseLine, im.PurchaseEvent, im.PlannedItem, im.SpendingPlan, im.CategoryPreference, models.Expense]:
                self.assertEqual(db.query(table).count(), 0)
            self.assertEqual(db.query(models.User).count(), 1)
        self.assertEqual(self.client.get('/api/auth/me', headers=other).status_code, 200)
