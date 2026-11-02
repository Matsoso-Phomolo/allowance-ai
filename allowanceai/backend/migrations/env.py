import os
from alembic import context
from sqlalchemy import create_engine, pool
from dotenv import load_dotenv
import models
from database import Base
load_dotenv()
config = context.config
connection = config.attributes.get("connection")

def run(connection):
    from migrations.validation import validate_history, validate_legacy, validate_ledger
    validate_history(connection)
    # Revalidate a stamped baseline too; a known revision is not proof that
    # ownership/email constraints survived later manual schema changes.
    from sqlalchemy import inspect, text
    if inspect(connection).has_table('alembic_version'):
        revisions = list(connection.execute(text('SELECT version_num FROM alembic_version')).scalars())
        if revisions:
            validate_legacy(connection)
            validate_ledger(connection, revisions[0])
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

if connection is not None:
    run(connection)
elif context.is_offline_mode():
    context.configure(url=os.environ["DATABASE_URL"], target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(os.environ["DATABASE_URL"], poolclass=pool.NullPool, hide_parameters=True)
    with engine.connect() as connection:
        run(connection)
