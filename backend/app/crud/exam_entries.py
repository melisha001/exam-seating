"""
crud/exam_entries.py — Database operations for ExamEntry.
"""

from sqlalchemy.orm import Session

from app.models.exam_entry import ExamEntry
from app.schemas.exam_entry import ExamEntryCreate, ExamEntryUpdate


def get_entries(
    db: Session, session_id: int | None = None, skip: int = 0, limit: int | None = None
) -> list[ExamEntry]:
    q = db.query(ExamEntry)
    if session_id is not None:
        q = q.filter(ExamEntry.session_id == session_id)
    if skip > 0:
        q = q.offset(skip)
    if limit is not None:
        q = q.limit(limit)
    return q.all()


def get_entry(db: Session, entry_id: int) -> ExamEntry | None:
    return db.get(ExamEntry, entry_id)


def create_entry(db: Session, data: ExamEntryCreate) -> ExamEntry:
    entry = ExamEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_entry(db: Session, entry: ExamEntry, data: ExamEntryUpdate) -> ExamEntry:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, entry: ExamEntry) -> None:
    db.delete(entry)
    db.commit()
