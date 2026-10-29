"""Run the API suite in temporary schemas on an explicitly loopback PostgreSQL server."""
import os
from pathlib import Path
import unittest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

if __name__ == "__main__":
    backend = Path(__file__).resolve().parents[1]
    value = os.environ.get("WORKSPACE_TEST_POSTGRES_URL") or dotenv_values(backend / ".env").get("DATABASE_URL")
    if not value:
        raise SystemExit("No local PostgreSQL test connection is configured.")
    parsed = make_url(value)
    if parsed.get_backend_name() != "postgresql" or parsed.host not in {"localhost", "127.0.0.1"}:
        raise SystemExit("Refusing non-loopback PostgreSQL credentials. No connection was made.")
    os.environ["WORKSPACE_TEST_POSTGRES_URL"] = value
    suite = unittest.defaultTestLoader.discover(str(backend / "tests"), pattern="test_workspace.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
