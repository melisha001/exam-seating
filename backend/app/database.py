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
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        try:
            with engine.begin() as conn:
                # exam_entries migrations
                result = conn.exec_driver_sql("PRAGMA table_info(exam_entries)")
                cols = {row[1] for row in result.fetchall()}
                if "subject_code" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN subject_code VARCHAR(50)")
                if "exclusions" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN exclusions TEXT")
                if "is_arrear" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN is_arrear BOOLEAN DEFAULT 0 NOT NULL")
                if "medium" not in cols and cols:
                    conn.exec_driver_sql("ALTER TABLE exam_entries ADD COLUMN medium VARCHAR(10) DEFAULT 'EN' NOT NULL")

                # rooms migrations for two in-charges
                result = conn.exec_driver_sql("PRAGMA table_info(rooms)")
                room_cols = {row[1] for row in result.fetchall()}
                if "invigilator2_name" not in room_cols and room_cols:
                    conn.exec_driver_sql("ALTER TABLE rooms ADD COLUMN invigilator2_name VARCHAR(150)")
                if "invigilator1_subject" not in room_cols and room_cols:
                    conn.exec_driver_sql("ALTER TABLE rooms ADD COLUMN invigilator1_subject VARCHAR(150)")
                if "invigilator2_subject" not in room_cols and room_cols:
                    conn.exec_driver_sql("ALTER TABLE rooms ADD COLUMN invigilator2_subject VARCHAR(150)")
                if "bench_config" not in room_cols and room_cols:
                    conn.exec_driver_sql("ALTER TABLE rooms ADD COLUMN bench_config TEXT")
                if "seater_mode" not in room_cols and room_cols:
                    conn.exec_driver_sql("ALTER TABLE rooms ADD COLUMN seater_mode VARCHAR(20) DEFAULT 'auto' NOT NULL")

                # seat_assignments migrations
                result = conn.exec_driver_sql("PRAGMA table_info(seat_assignments)")
                seat_cols = {row[1] for row in result.fetchall()}
                if "subject_code" not in seat_cols and seat_cols:
                    conn.exec_driver_sql("ALTER TABLE seat_assignments ADD COLUMN subject_code VARCHAR(50)")
                if "is_arrear" not in seat_cols and seat_cols:
                    conn.exec_driver_sql("ALTER TABLE seat_assignments ADD COLUMN is_arrear BOOLEAN DEFAULT 0 NOT NULL")
                if "is_locked" not in seat_cols and seat_cols:
                    conn.exec_driver_sql("ALTER TABLE seat_assignments ADD COLUMN is_locked BOOLEAN DEFAULT 0 NOT NULL")
                if "seat_label" not in seat_cols and seat_cols:
                    conn.exec_driver_sql("ALTER TABLE seat_assignments ADD COLUMN seat_label VARCHAR(20) DEFAULT '' NOT NULL")
                if "medium" not in seat_cols and seat_cols:
                    conn.exec_driver_sql("ALTER TABLE seat_assignments ADD COLUMN medium VARCHAR(10) DEFAULT 'EN'")
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
