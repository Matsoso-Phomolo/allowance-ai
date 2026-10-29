"""Disposable local API for browser regression tests. Never reads a real database URL."""
import os
import sys
import tempfile
from pathlib import Path

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="allowanceai-workspace-test-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "test.db").replace("\\", "/")
        os.environ["ALLOWANCEAI_SECRET_KEY"] = "local-browser-regression-secret-not-production"
        os.environ.pop("ALLOWANCEAI_ADMIN_EMAILS", None)
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        import uvicorn
        import main
        try:
            uvicorn.run(main.app, host="127.0.0.1", port=8001, log_level="warning")
        finally:
            main.engine.dispose()
