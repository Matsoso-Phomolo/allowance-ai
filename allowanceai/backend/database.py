from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in the environment.")

options = {"pool_pre_ping": True, "pool_recycle": 300, "hide_parameters": True}
if DATABASE_URL.startswith(("postgresql", "postgres://")):
    options["connect_args"] = {"connect_timeout": 10}
engine = create_engine(DATABASE_URL, **options)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
