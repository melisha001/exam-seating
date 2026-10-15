"""
algorithm/models.py — Pure dataclasses for algorithm input/output.

Intentionally decoupled from SQLAlchemy ORM so the algorithm can be
unit-tested without a database.
"""

from dataclasses import dataclass


# ── Inputs ────────────────────────────────────────────────────────────────────

@dataclass
class DeptGroup:
    """
    One department's exam entry for a session.

    `rolls` is an ordered list of roll numbers assigned in order.
    `subject_code` can be provided (e.g. CS8492). If not provided, `subject` is used.
    `is_arrear` indicates if this entry contains arrear students.
    `medium` indicates English (EN) or Tamil (TA).
    """
    dept_id: int
    dept_code: str
    subject: str
    rolls: list[str]
    subject_code: str | None = None
    is_arrear: bool = False
    medium: str = "EN"


@dataclass
class RoomSpec:
    """Physical layout of an exam room."""
    room_id: int
    room_name: str
    rows: int
    cols: int
    seats_per_bench: int
    invigilator_name: str | None = None
    invigilator2_name: str | None = None
    invigilator1_subject: str | None = None
    invigilator2_subject: str | None = None
    bench_config: dict[str, int] | str | None = None
    seater_mode: str = "auto"

    def get_bench_seats(self, row: int, col: int) -> int:
        """Return seats count on bench (row, col) (1, 2, or 3, default seats_per_bench)."""
        if self.bench_config:
            if isinstance(self.bench_config, str):
                try:
                    import json
                    cfg = json.loads(self.bench_config)
                except Exception:
                    cfg = {}
            else:
                cfg = self.bench_config

            if isinstance(cfg, dict):
                key = f"{row}-{col}"
                if key in cfg:
                    return int(cfg[key])
            elif isinstance(cfg, list) and row < len(cfg) and col < len(cfg[row]):
                return int(cfg[row][col])
        return self.seats_per_bench

    @property
    def capacity(self) -> int:
        return sum(
            self.get_bench_seats(r, c)
            for r in range(self.rows)
            for c in range(self.cols)
        )

    @property
    def seater_breakdown(self) -> str:
        from app.algorithm.labels import get_seater_breakdown
        return get_seater_breakdown(self.rows, self.cols, self.seats_per_bench, self.bench_config)



# ── Outputs ───────────────────────────────────────────────────────────────────

@dataclass
class SeatInfo:
    """State of one physical seat in the final plan."""
    row: int
    col: int
    seat_index: int          # 0-indexed within the bench
    roll_number: str | None
    dept_id: int | None
    dept_code: str | None
    subject: str | None
    subject_code: str | None = None
    medium: str | None = "EN"
    is_empty: bool = False   # True when physically empty (e.g. no more students)
    is_arrear: bool = False
    is_locked: bool = False
    seat_label: str = ""     # Standard label e.g. A1, B1, C1


@dataclass
class RoomResult:
    """Algorithm output for one room."""
    room_id: int
    room_name: str
    invigilator_name: str | None
    seats: list[SeatInfo]    # all seats including empty ones, row-major order
    capacity: int            # rows × cols × seats_per_bench
    assigned: int            # seats with a student
    utilization_pct: float   # assigned / capacity × 100, rounded to 1 dp


@dataclass
class SeatingResult:
    """Top-level output of generate_seating()."""
    room_results: list[RoomResult]
    rooms_used: int
    total_assigned: int
    unseated_count: int
    warnings: list[str]

    @property
    def rooms(self) -> list[RoomResult]:
        return self.room_results
