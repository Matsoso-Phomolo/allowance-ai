"""Run with python -m unittest discover -s tests -v. Uses isolated SQLite or explicitly loopback-only PostgreSQL test schemas."""
import os
import sys
import unittest
import uuid
import ipaddress
from datetime import date
from pathlib import Path

# Set before application imports: never load the developer or production database.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ALLOWANCEAI_SECRET_KEY"] = "isolated-regression-test-secret-not-for-production"
os.environ.pop("ALLOWANCEAI_ADMIN_EMAILS", None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateTable, CreateSchema, DropSchema
from sqlalchemy.engine import make_url
from sqlalchemy.dialects import postgresql
import main
import models
from database import Base, get_db


class WorkspaceFinancialTests(unittest.TestCase):
    def setUp(self):
        self.schema = None
        self.admin_engine = None
        postgres_url = os.getenv("WORKSPACE_TEST_POSTGRES_URL")
        if postgres_url:
            parsed = make_url(postgres_url)
            if parsed.get_backend_name() != "postgresql" or parsed.host not in {"localhost", "127.0.0.1"}:
                raise RuntimeError("PostgreSQL regressions require a loopback test database.")
            self.schema = "allowanceai_workspace_test_" + uuid.uuid4().hex
            self.admin_engine = create_engine(parsed, connect_args={"connect_timeout": 5})
            with self.admin_engine.begin() as connection:
                address = ipaddress.ip_address(connection.exec_driver_sql("SELECT host(inet_server_addr())").scalar())
                mapped = getattr(address, "ipv4_mapped", None)
                if not (address.is_loopback or (mapped and mapped.is_loopback)):
                    raise RuntimeError("Refusing schema tests on a non-loopback PostgreSQL server.")
                connection.execute(CreateSchema(self.schema))
            self.engine = create_engine(parsed, connect_args={"connect_timeout": 5, "options": f"-csearch_path={self.schema}"})
        else:
            self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
            @event.listens_for(self.engine, "connect")
            def foreign_keys(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.original_engine, self.original_sessions = main.engine, main.SessionLocal
        main.engine, main.SessionLocal = self.engine, self.sessions
        def test_db():
            with self.sessions() as db:
                yield db
        main.app.dependency_overrides[get_db] = test_db
        self.client = TestClient(main.app)
        self.client.__enter__()
        self.month = date.today().strftime("%Y-%m")
        self.other_month = "2020-01" if self.month != "2020-01" else "2020-02"

    def tearDown(self):
        self.client.__exit__(None, None, None)
        main.app.dependency_overrides.clear()
        main.engine, main.SessionLocal = self.original_engine, self.original_sessions
        if self.schema:
            # Only these newly created local test tables are removed. No public/production tables.
            Base.metadata.drop_all(self.engine)
        self.engine.dispose()
        if self.admin_engine:
            with self.admin_engine.begin() as connection:
                connection.execute(DropSchema(self.schema))
            self.admin_engine.dispose()

    def register(self, name="alice"):
        result = self.client.post("/api/auth/register", json={"name": name, "email": f"{name}@example.invalid", "password": "test-password-42"})
        self.assertEqual(result.status_code, 200, result.text)
        return {"Authorization": f"Bearer {result.json()['access_token']}"}

    def post(self, path, body, headers):
        response = self.client.post(path, json=body, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def summary(self, headers, month=None):
        result = self.client.get("/api/budget", headers=headers, params={"month": month} if month else {})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def category(self, headers, name="Food", amount=500):
        return self.post("/api/categories", {"name": name, "planned_amount": amount}, headers)

    def expense(self, headers, name="Lunch", amount=125.25, month=None):
        return self.post("/api/expenses", {"item_name": name, "amount": amount, "category_name": "Food", "expense_date": f"{month or self.month}-02"}, headers)

    def test_registration_has_zero_totals_and_no_seeded_financial_records(self):
        headers = self.register()
        data = self.summary(headers)
        self.assertFalse(data["configured"])
        self.assertEqual(data["month"], self.month)
        for field in ["allowance", "savings_target", "total_planned", "total_spent", "remaining_money"]:
            self.assertEqual(data[field], 0)
        for path in ["/api/categories", "/api/expenses", "/api/shopping-lists", "/api/notifications"]:
            self.assertEqual(self.client.get(path, headers=headers).json(), [])
        # Reading insights must not persist fictional financial reminders for a new account.
        self.assertEqual(self.client.get("/api/insights/monthly", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/api/notifications", headers=headers).json(), [])
        with self.sessions() as db:
            for table in Base.metadata.sorted_tables:
                if table.name != "users":
                    self.assertEqual(db.execute(select(func.count()).select_from(table)).scalar(), 0, table.name)

    def test_explicit_zero_budget_is_configured_without_fake_notifications(self):
        headers = self.register()
        self.post("/api/budget", {"month": self.month, "allowance": 0, "savings_target": 0}, headers)
        self.assertTrue(self.summary(headers)["configured"])
        self.assertEqual(self.summary(headers)["allowance"], 0)
        self.assertEqual(self.client.get("/api/notifications", headers=headers).json(), [])
        self.category(headers, amount=0)
        self.assertEqual(self.client.get("/api/categories", headers=headers).json()[0]["percentage_used"], 0)

    def test_monthly_totals_use_persisted_records_and_keep_full_history(self):
        headers = self.register()
        self.post("/api/budget", {"month": self.month, "allowance": 1000, "savings_target": 100}, headers)
        self.category(headers)
        self.expense(headers)
        self.post("/api/budget", {"month": self.other_month, "allowance": 750, "savings_target": 50}, headers)
        self.expense(headers, name="Past lunch", amount=80, month=self.other_month)
        current = self.summary(headers)
        self.assertEqual(current["allowance"], 1000)
        self.assertEqual(current["total_planned"], 500)
        self.assertEqual(current["total_spent"], 125.25)
        self.assertEqual(current["remaining_money"], 874.75)
        self.assertEqual(self.summary(headers, self.other_month)["total_spent"], 80)
        self.assertEqual(len(self.client.get("/api/expenses", headers=headers).json()), 2)
        self.assertEqual(self.client.get("/api/categories", headers=headers).json()[0]["spent_amount"], 125.25)
        report = self.client.get("/api/reports/monthly", headers=headers).json()
        self.assertEqual(report["total_spent"], 125.25)
        self.assertEqual(len(report["top_expenses"]), 1)
        self.assertEqual(report["top_expenses"][0]["item_name"], "Lunch")

    def test_other_month_does_not_configure_current_month(self):
        headers = self.register()
        self.post("/api/budget", {"month": self.other_month, "allowance": 250, "savings_target": 0}, headers)
        self.assertFalse(self.summary(headers)["configured"])
        self.assertEqual(self.summary(headers)["allowance"], 0)
        self.assertTrue(self.summary(headers, self.other_month)["configured"])

    def test_account_isolation_and_authorization(self):
        alice, bob = self.register(), self.register("bob")
        category = self.category(alice)
        self.post("/api/budget", {"month": self.month, "allowance": 1000, "savings_target": 100}, alice)
        expense = self.expense(alice)["expense"]
        shopping = self.post("/api/shopping-lists", {"name": "Groceries", "items": [{"item_name": "Bread", "amount": 20, "category_name": "Food"}]}, alice)
        self.assertFalse(self.summary(bob)["configured"])
        for path in ["/api/categories", "/api/expenses", "/api/shopping-lists", "/api/notifications"]:
            self.assertEqual(self.client.get(path, headers=bob).json(), [])
        self.assertEqual(self.client.put(f"/api/categories/{category['id']}", json={"name": "Hijack", "planned_amount": 1}, headers=bob).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/expenses/{expense['id']}", headers=bob).status_code, 404)
        self.assertEqual(self.client.get(f"/api/shopping-lists/{shopping['id']}", headers=bob).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/shopping-lists/{shopping['id']}", headers=bob).status_code, 404)
        self.assertEqual(self.client.get("/api/admin/stats", headers=bob).status_code, 403)
        self.assertIn(self.client.get("/api/budget").status_code, [401, 403])
        self.assertEqual(self.summary(alice)["remaining_money"], 874.75)

    def test_login_persistence_expense_updates_and_existing_record_preservation(self):
        alice = self.register()
        category = self.category(alice)
        self.post("/api/budget", {"month": self.month, "allowance": 1000, "savings_target": 100}, alice)
        expense = self.expense(alice)["expense"]
        self.register("bob")
        login = self.client.post("/api/auth/login", json={"email": "alice@example.invalid", "password": "test-password-42"})
        self.assertEqual(login.status_code, 200)
        fresh = {"Authorization": f"Bearer {login.json()['access_token']}"}
        self.assertEqual(self.client.get("/api/auth/me", headers=fresh).json()["name"], "alice")
        self.assertEqual(self.summary(fresh)["remaining_money"], 874.75)
        updated = self.client.put(f"/api/expenses/{expense['id']}", headers=fresh, json={"item_name":"Lunch revised", "amount":150.5,"category_name":"Food","expense_date":f"{self.month}-03"})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(self.summary(fresh)["remaining_money"], 849.5)
        self.post("/api/budget", {"month": self.month, "allowance": 1100, "savings_target": 100}, fresh)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Budget).filter(models.Budget.user_id == login.json()["user"]["id"]).count(), 1)
        self.assertEqual(self.summary(fresh)["remaining_money"], 949.5)
        self.assertEqual(self.client.delete(f"/api/categories/{category['id']}", headers=fresh).status_code, 400)
        self.assertEqual(len(self.client.get("/api/expenses", headers=fresh).json()), 1)

    def test_invalid_operations_do_not_create_financial_records(self):
        headers = self.register()
        self.assertEqual(self.client.post("/api/budget", headers=headers, json={"month":"2026-99","allowance":100}).status_code,422)
        self.assertEqual(self.client.get("/api/budget?month=0000-01", headers=headers).status_code,422)
        self.assertEqual(self.client.post("/api/expenses", headers=headers, json={"item_name":"Missing category","amount":10,"category_name":"Unknown"}).status_code,404)
        self.assertEqual(self.client.post("/api/expenses", headers=headers, json={"item_name":"Invalid amount","amount":-1,"category_name":"Unknown"}).status_code,422)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Budget).count(),0)
            self.assertEqual(db.query(models.Expense).count(),0)

    def test_missing_budget_does_not_hide_persisted_spending(self):
        headers = self.register()
        self.category(headers)
        self.expense(headers)
        summary = self.summary(headers)
        self.assertFalse(summary["configured"])
        self.assertEqual(summary["allowance"], 0)
        self.assertEqual(summary["total_spent"], 125.25)
        self.assertEqual(summary["remaining_money"], -125.25)
        self.assertEqual(summary["total_planned"], 500)
        with self.sessions() as db:
            self.assertEqual(db.query(models.Budget).count(), 0)
            self.assertEqual(db.query(models.Expense).count(), 1)

    def test_models_compile_for_postgresql_without_schema_changes(self):
        for table in Base.metadata.sorted_tables:
            ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
            self.assertIn("CREATE TABLE",ddl)
            if table.name not in {"users","shopping_list_items"}:
                self.assertTrue(any(fk.target_fullname == "users.id" for fk in table.foreign_keys))

if __name__ == "__main__":
    unittest.main()
