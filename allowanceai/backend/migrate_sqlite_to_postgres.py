import os
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, text

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


SQLITE_PATH = Path(__file__).with_name("allowanceai.db")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set before running this migration.")


def rows_from_sqlite(connection, table_name):
    cursor = connection.execute(f"SELECT * FROM {table_name}")
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def insert_rows(pg_connection, table_name, rows):
    if not rows:
        return

    columns = list(rows[0].keys())
    column_sql = ", ".join(columns)
    value_sql = ", ".join(f":{column}" for column in columns)
    update_sql = ", ".join(f"{column}=EXCLUDED.{column}" for column in columns if column != "id")
    statement = text(
        f"""
        INSERT INTO {table_name} ({column_sql})
        VALUES ({value_sql})
        ON CONFLICT (id) DO UPDATE SET {update_sql}
        """
    )
    for row in rows:
        pg_connection.execute(statement, row)
    pg_connection.execute(
        text(
            f"""
            SELECT setval(
                pg_get_serial_sequence('{table_name}', 'id'),
                COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                true
            )
            """
        )
    )


def main():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_PATH}")

    sqlite_connection = sqlite3.connect(SQLITE_PATH)
    sqlite_connection.row_factory = sqlite3.Row
    postgres_engine = create_engine(DATABASE_URL)

    tables = ["users", "budgets", "categories", "expenses"]
    with postgres_engine.begin() as pg_connection:
        for table_name in tables:
            rows = rows_from_sqlite(sqlite_connection, table_name)
            insert_rows(pg_connection, table_name, rows)
            print(f"Migrated {len(rows)} rows from {table_name}.")

    sqlite_connection.close()
    print("Migration complete. SQLite database was not deleted.")


if __name__ == "__main__":
    main()
