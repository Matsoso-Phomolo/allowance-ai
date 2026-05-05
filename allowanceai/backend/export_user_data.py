import json
import os
from pathlib import Path

from sqlalchemy import func

import crud
import models
from database import SessionLocal


def main():
    email = os.getenv("EXPORT_USER_EMAIL", "").strip().lower()
    if not email:
        raise RuntimeError("Set EXPORT_USER_EMAIL to the account email to export.")

    output_path = Path(os.getenv("EXPORT_OUTPUT_PATH", f"allowanceai-export-{email.replace('@', '_at_')}.json"))

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
        if not user:
            raise RuntimeError(f"No user found for {email}.")

        data = crud.export_user_data(db, user)
        output_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        print(f"Exported {email} data to {output_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
