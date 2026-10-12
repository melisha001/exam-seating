"""
models/exam_entry.py — ExamEntry ORM model.

Each entry describes one department's exam in a given session:
which subject, how many students, and an optional roll-number range
for ordered assignment.
"""

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
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
    student_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional: alphanumeric roll-number range (e.g. "21CSE001" – "21CSE060")
    roll_start: Mapped[str | None] = mapped_column(String(50), nullable=True)
    roll_end: Mapped[str | None] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        CheckConstraint("student_count > 0", name="ck_entry_student_count_positive"),
    )

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="exam_entries")
    department: Mapped["Department"] = relationship("Department", back_populates="exam_entries")
