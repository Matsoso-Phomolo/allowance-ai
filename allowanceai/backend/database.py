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

engine = create_engine(DATABASE_URL)

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
