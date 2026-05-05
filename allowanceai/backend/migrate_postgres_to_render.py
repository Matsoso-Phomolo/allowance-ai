import os

from sqlalchemy import bindparam, create_engine, text

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


SOURCE_DATABASE_URL = os.getenv("SOURCE_DATABASE_URL") or os.getenv("DATABASE_URL")
TARGET_DATABASE_URL = os.getenv("TARGET_DATABASE_URL")
ONLY_EMAIL = os.getenv("MIGRATE_USER_EMAIL", "").strip().lower()

TABLES = [
    "users",
    "budgets",
    "categories",
    "expenses",
    "daily_spending_log",
    "category_daily_totals",
]

USER_SCOPED_TABLES = [
    "budgets",
    "categories",
    "expenses",
    "daily_spending_log",
    "category_daily_totals",
]


def require_env():
    if not SOURCE_DATABASE_URL:
        raise RuntimeError("SOURCE_DATABASE_URL or DATABASE_URL must be set.")
    if not TARGET_DATABASE_URL:
        raise RuntimeError("TARGET_DATABASE_URL must be set to the Render PostgreSQL external database URL.")
    if SOURCE_DATABASE_URL == TARGET_DATABASE_URL:
        raise RuntimeError("Source and target database URLs are the same. Refusing to migrate.")


def rows_from_source(connection, table_name, user_ids):
    if table_name == "users":
        if ONLY_EMAIL:
            return connection.execute(
                text("SELECT * FROM users WHERE lower(email) = :email"),
                {"email": ONLY_EMAIL},
            ).mappings().all()
        return connection.execute(text("SELECT * FROM users")).mappings().all()

    if table_name in USER_SCOPED_TABLES and user_ids:
        statement = text(f"SELECT * FROM {table_name} WHERE user_id IN :user_ids").bindparams(
            bindparam("user_ids", expanding=True)
        )
        return connection.execute(
            statement,
            {"user_ids": user_ids},
        ).mappings().all()

    if table_name in USER_SCOPED_TABLES:
        return []

    return connection.execute(text(f"SELECT * FROM {table_name}")).mappings().all()


def upsert_rows(connection, table_name, rows):
    if not rows:
        return 0

    rows = [dict(row) for row in rows]
    columns = list(rows[0].keys())
    column_sql = ", ".join(columns)
    value_sql = ", ".join(f":{column}" for column in columns)
    update_columns = [column for column in columns if column != "id"]
    update_sql = ", ".join(f"{column}=EXCLUDED.{column}" for column in update_columns)

    statement = text(
        f"""
        INSERT INTO {table_name} ({column_sql})
        VALUES ({value_sql})
        ON CONFLICT (id) DO UPDATE SET {update_sql}
        """
    )
    for row in rows:
        connection.execute(statement, row)

    reset_sequence(connection, table_name)
    return len(rows)


def reset_sequence(connection, table_name):
    connection.execute(
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
    require_env()
    source_engine = create_engine(SOURCE_DATABASE_URL)
    target_engine = create_engine(TARGET_DATABASE_URL)

    with source_engine.connect() as source_connection:
        user_rows = rows_from_source(source_connection, "users", [])
        user_ids = [row["id"] for row in user_rows]

        if ONLY_EMAIL and not user_rows:
            raise RuntimeError(f"No local user found for {ONLY_EMAIL}.")

        with target_engine.begin() as target_connection:
            migrated = upsert_rows(target_connection, "users", user_rows)
            print(f"Migrated {migrated} rows from users.")

            for table_name in TABLES[1:]:
                rows = rows_from_source(source_connection, table_name, user_ids)
                migrated = upsert_rows(target_connection, table_name, rows)
                print(f"Migrated {migrated} rows from {table_name}.")

    print("Migration complete. Local data was copied to the target database; local data was not deleted.")


if __name__ == "__main__":
    main()
