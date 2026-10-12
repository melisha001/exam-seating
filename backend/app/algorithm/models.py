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

    `rolls` is an ordered list of roll numbers assigned in order
    (first roll → first valid seat in reading order).
    """
    dept_id: int
    dept_code: str
    subject: str
    rolls: list[str]


@dataclass
class RoomSpec:
    """Physical layout of an exam room."""
    room_id: int
    room_name: str
    rows: int
    cols: int
    seats_per_bench: int
    invigilator_name: str | None = None


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
    is_empty: bool = False   # True when deliberately left blank by the algorithm


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
