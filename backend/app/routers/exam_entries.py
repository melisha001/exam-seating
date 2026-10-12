"""
routers/exam_entries.py — FastAPI routes for ExamEntry CRUD.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.exam_entry import ExamEntryCreate, ExamEntryRead, ExamEntryUpdate
import app.crud.exam_entries as crud
import app.crud.exam_sessions as session_crud
import app.crud.departments as dept_crud

router = APIRouter(prefix="/entries", tags=["Exam Entries"])


def _get_or_404(db: Session, entry_id: int):
    entry = crud.get_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found.")
    return entry


def _validate_fks(db: Session, session_id: int, department_id: int) -> None:
    """Raise 422 if FK targets don't exist."""
    if not session_crud.get_session(db, session_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Session {session_id} does not exist.",
        )
    if not dept_crud.get_department(db, department_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Department {department_id} does not exist.",
        )


@router.get("/", response_model=list[ExamEntryRead])
def list_entries(
    session_id: int | None = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    """List entries, optionally filtered by session_id."""
    return crud.get_entries(db, session_id=session_id, skip=skip, limit=limit)


@router.post("/", response_model=ExamEntryRead, status_code=status.HTTP_201_CREATED)
def create_entry(data: ExamEntryCreate, db: Session = Depends(get_db)):
    _validate_fks(db, data.session_id, data.department_id)
    return crud.create_entry(db, data)


@router.get("/{entry_id}", response_model=ExamEntryRead)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, entry_id)


@router.put("/{entry_id}", response_model=ExamEntryRead)
def update_entry(entry_id: int, data: ExamEntryUpdate, db: Session = Depends(get_db)):
    entry = _get_or_404(db, entry_id)
    return crud.update_entry(db, entry, data)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = _get_or_404(db, entry_id)
    crud.delete_entry(db, entry)
