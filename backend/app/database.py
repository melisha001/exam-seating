"""
database.py — SQLAlchemy engine, session factory, and Base class.

All ORM models import Base from here. The session is provided as a
FastAPI dependency via `get_db()`.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


engine = create_engine(
    settings.database_url,
    # Required for SQLite so that the same connection can be used
    # across threads (FastAPI uses a thread pool for sync routes).
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""
    pass


def init_db_and_migrate():
    """Ensure tables exist and apply backward-compatible column migrations for SQLite."""
    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        try:
            with engine.begin() as conn:
                result = conn.exec_driver_sql("PRAGMA table_info(exam_entries)")
                cols = {row[1] for row in result.fetchall()}
                if "subject_code" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN subject_code VARCHAR(50)")
                if "exclusions" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN exclusions TEXT")
        except Exception:
            pass


init_db_and_migrate()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
