"""
crud/departments.py — Database operations for Department.
"""

from sqlalchemy.orm import Session

from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate


def get_departments(db: Session, skip: int = 0, limit: int = 100) -> list[Department]:
    return db.query(Department).offset(skip).limit(limit).all()


def get_department(db: Session, dept_id: int) -> Department | None:
    return db.get(Department, dept_id)


def create_department(db: Session, data: DepartmentCreate) -> Department:
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def update_department(db: Session, dept: Department, data: DepartmentUpdate) -> Department:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db: Session, dept: Department) -> None:
    db.delete(dept)
    db.commit()
