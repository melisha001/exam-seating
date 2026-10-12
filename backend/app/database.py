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


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
