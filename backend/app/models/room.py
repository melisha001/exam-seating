"""
models/room.py — Room ORM model.

A room is a rectangular grid of benches:
  total_seats = rows × columns × seats_per_bench
"""

from sqlalchemy import Integer, String, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    rows: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[int] = mapped_column(Integer, nullable=False)
    # Each bench holds 1, 2, or 3 students (same for every bench in the room)
    seats_per_bench: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    invigilator_name: Mapped[str | None] = mapped_column(String(150), nullable=True)

    __table_args__ = (
        CheckConstraint("rows > 0", name="ck_room_rows_positive"),
        CheckConstraint("columns > 0", name="ck_room_cols_positive"),
        CheckConstraint("seats_per_bench IN (1, 2, 3)", name="ck_seats_per_bench"),
    )

    # Relationships
    seat_assignments: Mapped[list["SeatAssignment"]] = relationship(
        "SeatAssignment", back_populates="room", cascade="all, delete-orphan"
    )

    @property
    def capacity(self) -> int:
        """Total individual seat count for this room."""
        return self.rows * self.columns * self.seats_per_bench
