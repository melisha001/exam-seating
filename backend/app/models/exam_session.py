"""
models/exam_session.py — ExamSession ORM model.

An exam session combines a calendar date with a label (e.g. "FN" / "AN").
The pair (date, label) is unique so the same hall can host two sessions on
the same day.
"""

from datetime import date as DateType

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[DateType] = mapped_column(Date, nullable=False)
    # Free-text label, e.g. "FN", "AN", "Morning", "Afternoon"
    label: Mapped[str] = mapped_column(String(50), nullable=False)

    __table_args__ = (
        UniqueConstraint("date", "label", name="uq_session_date_label"),
    )

    # Relationships
    exam_entries: Mapped[list["ExamEntry"]] = relationship(
        "ExamEntry", back_populates="session", cascade="all, delete-orphan"
    )
    seating_plan: Mapped["SeatingPlan | None"] = relationship(
        "SeatingPlan", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
