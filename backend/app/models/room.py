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
    invigilator2_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    invigilator1_subject: Mapped[str | None] = mapped_column(String(150), nullable=True)
    invigilator2_subject: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # JSON dictionary of {"row-col": seat_count} for mixed 2-seater/3-seater benches
    bench_config: Mapped[str | None] = mapped_column(String, nullable=True)
    # Seater mode: 'auto' or 'manual'
    seater_mode: Mapped[str] = mapped_column(String(20), default="auto", nullable=False)

    __table_args__ = (
        CheckConstraint("rows > 0", name="ck_room_rows_positive"),
        CheckConstraint("columns > 0", name="ck_room_cols_positive"),
        CheckConstraint("seats_per_bench IN (1, 2, 3)", name="ck_seats_per_bench"),
    )

    # Relationships
    seat_assignments: Mapped[list["SeatAssignment"]] = relationship(
        "SeatAssignment", back_populates="room", cascade="all, delete-orphan"
    )

    def get_bench_seats(self, row: int, col: int) -> int:
        """Return seat count for bench at (row, col) (2 or 3, default seats_per_bench)."""
        if self.bench_config:
            try:
                import json
                cfg = json.loads(self.bench_config)
                if isinstance(cfg, dict):
                    key = f"{row}-{col}"
                    if key in cfg:
                        return int(cfg[key])
                elif isinstance(cfg, list) and row < len(cfg) and col < len(cfg[row]):
                    return int(cfg[row][col])
            except Exception:
                pass
        return self.seats_per_bench

    @property
    def capacity(self) -> int:
        """Total individual seat count for this room across all benches."""
        total = 0
        for r in range(self.rows):
            for c in range(self.columns):
                total += self.get_bench_seats(r, c)
        return total

    @property
    def seater_breakdown(self) -> str:
        """Formatted seater breakdown e.g. '3S x 6 - 2S x 3 - 1S x 2' or 'All 2-Seaters'."""
        from app.algorithm.labels import get_seater_breakdown
        return get_seater_breakdown(self.rows, self.columns, self.seats_per_bench, self.bench_config)

