"""
crud/exam_sessions.py — Database operations for ExamSession.
"""

from sqlalchemy.orm import Session

from app.models.exam_session import ExamSession
from app.schemas.exam_session import ExamSessionCreate, ExamSessionUpdate


def get_sessions(db: Session, skip: int = 0, limit: int = 100) -> list[ExamSession]:
    return db.query(ExamSession).order_by(ExamSession.date.desc()).offset(skip).limit(limit).all()


def get_session(db: Session, session_id: int) -> ExamSession | None:
    return db.get(ExamSession, session_id)


def create_session(db: Session, data: ExamSessionCreate) -> ExamSession:
    session = ExamSession(**data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def update_session(db: Session, session: ExamSession, data: ExamSessionUpdate) -> ExamSession:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: Session, session: ExamSession) -> None:
    db.delete(session)
    db.commit()
