"""
models/seating_plan.py — SeatingPlan and SeatAssignment ORM models.

SeatingPlan   — one per session; stores metadata and warnings.
SeatAssignment — one row per physical seat in the plan.
"""

import json
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SeatingPlan(Base):
    __tablename__ = "seating_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # JSON-encoded list of warning strings, e.g.
    # '["Only 1 department; alternate seats left empty."]'
    _warnings_json: Mapped[str] = mapped_column("warnings_json", Text, default="[]", nullable=False)
    unseated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="seating_plan")
    seat_assignments: Mapped[list["SeatAssignment"]] = relationship(
        "SeatAssignment", back_populates="plan", cascade="all, delete-orphan"
    )

    @property
    def warnings(self) -> list[str]:
        return json.loads(self._warnings_json or "[]")

    @warnings.setter
    def warnings(self, value: list[str]) -> None:
        self._warnings_json = json.dumps(value)


class SeatAssignment(Base):
    __tablename__ = "seat_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("seating_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )

    row: Mapped[int] = mapped_column(Integer, nullable=False)      # 0-indexed
    col: Mapped[int] = mapped_column(Integer, nullable=False)      # 0-indexed
    seat_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-indexed within bench

    # Nullable — empty when the seat is intentionally left blank
    roll_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # True when the seat is deliberately left empty (constraint-driven)
    is_empty: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    plan: Mapped["SeatingPlan"] = relationship("SeatingPlan", back_populates="seat_assignments")
    room: Mapped["Room"] = relationship("Room", back_populates="seat_assignments")
    department: Mapped["Department | None"] = relationship(
        "Department", back_populates="seat_assignments"
    )
