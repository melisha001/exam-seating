"""
routers/exam_sessions.py — FastAPI routes for ExamSession CRUD.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.schemas.exam_session import ExamSessionCreate, ExamSessionRead, ExamSessionUpdate
import app.crud.exam_sessions as crud

router = APIRouter(prefix="/sessions", tags=["Exam Sessions"])


def _get_or_404(db: Session, session_id: int):
    s = crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    return s


@router.get("/", response_model=list[ExamSessionRead])
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Return all exam sessions, most recent first."""
    return crud.get_sessions(db, skip=skip, limit=limit)


@router.post("/", response_model=ExamSessionRead, status_code=status.HTTP_201_CREATED)
def create_session(data: ExamSessionCreate, db: Session = Depends(get_db)):
    """Create a session. (date, label) must be unique."""
    try:
        return crud.create_session(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A session on {data.date} ({data.label}) already exists.",
        )


@router.get("/{session_id}", response_model=ExamSessionRead)
def get_session(session_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, session_id)


@router.put("/{session_id}", response_model=ExamSessionRead)
def update_session(session_id: int, data: ExamSessionUpdate, db: Session = Depends(get_db)):
    session = _get_or_404(db, session_id)
    try:
        return crud.update_session(db, session, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That date/label combination already exists.",
        )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = _get_or_404(db, session_id)
    crud.delete_session(db, session)
