"""
routers/departments.py — FastAPI routes for Department CRUD.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
import app.crud.departments as crud

router = APIRouter(prefix="/departments", tags=["Departments"])


def _get_or_404(db: Session, dept_id: int):
    dept = crud.get_department(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department {dept_id} not found.")
    return dept


@router.get("/", response_model=list[DepartmentRead])
def list_departments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_departments(db, skip=skip, limit=limit)


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_department(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with name '{data.name}' or code '{data.code}' already exists.",
        )


@router.get("/{dept_id}", response_model=DepartmentRead)
def get_department(dept_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, dept_id)


@router.put("/{dept_id}", response_model=DepartmentRead)
def update_department(dept_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = _get_or_404(db, dept_id)
    try:
        return crud.update_department(db, dept, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Department name or code conflicts with an existing record.",
        )


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = _get_or_404(db, dept_id)
    crud.delete_department(db, dept)
