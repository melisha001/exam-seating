"""
models/department.py — Department ORM model.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Relationships
    exam_entries: Mapped[list["ExamEntry"]] = relationship(
        "ExamEntry", back_populates="department", cascade="all, delete-orphan"
    )
    seat_assignments: Mapped[list["SeatAssignment"]] = relationship(
        "SeatAssignment", back_populates="department"
    )
