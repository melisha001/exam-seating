"""
models/exam_entry.py — ExamEntry ORM model.

Each entry describes one department's exam in a given session:
which subject, how many students, and an optional roll-number range
for ordered assignment.
"""

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExamEntry(Base):
    __tablename__ = "exam_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True
    )

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    subject_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional: alphanumeric roll-number range (e.g. "927623BCS001" – "927623BCS060")
    roll_start: Mapped[str | None] = mapped_column(String(50), nullable=True)
    roll_end: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Optional: comma/space-separated excluded register numbers (absentees)
    exclusions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_arrear: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    medium: Mapped[str] = mapped_column(String(10), default="EN", nullable=False)

    __table_args__ = (
        CheckConstraint("student_count > 0", name="ck_entry_student_count_positive"),
    )

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="exam_entries")
    department: Mapped["Department"] = relationship("Department", back_populates="exam_entries")
