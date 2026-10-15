"""
schemas/plan_request.py — Request/response schemas for plan generation, swap, and branch-wise summary.
"""

from pydantic import BaseModel, Field


class GeneratePlanRequest(BaseModel):
    """Body for POST /plans/generate"""
    session_id: int = Field(..., description="The exam session to generate a plan for.")
    room_ids: list[int] = Field(
        ..., min_length=1, description="Ordered list of room IDs to fill."
    )
    check_front_back: bool = Field(
        True, description="Treat bench directly ahead/behind as adjacent (stricter)."
    )
    treat_different_medium_as_different_paper: bool = Field(
        False, description="When True, EN and TA of the same subject code are treated as different subjects."
    )
    equal_students_per_hall: bool = Field(
        False, description="When True, distribute equal student counts across halls if capacities allow."
    )


class SwapRequest(BaseModel):
    """Body for PUT /plans/{plan_id}/swap"""
    seat_id_a: int = Field(..., description="ID of the first SeatAssignment.")
    seat_id_b: int = Field(..., description="ID of the second SeatAssignment.")


class PlanSummary(BaseModel):
    """Lightweight plan overview (no seat list)."""
    plan_id: int
    session_id: int
    rooms_used: int
    total_assigned: int
    unseated_count: int
    warnings: list[str]

    model_config = {"from_attributes": True}


class RoomGrid(BaseModel):
    """Per-room result as returned by the API."""
    room_id: int
    room_name: str
    invigilator_name: str | None
    invigilator2_name: str | None = None
    invigilator1_subject: str | None = None
    invigilator2_subject: str | None = None
    capacity: int
    assigned: int
    utilization_pct: float
    rows: int | None = None
    columns: int | None = None
    bench_config: str | None = None
    seater_mode: str | None = "auto"
    seater_breakdown: str | None = None
    seats: list[dict]   # list of SeatAssignmentRead-compatible dicts

    model_config = {"from_attributes": True}



class PlanDetail(PlanSummary):
    """Full plan with per-room grids."""
    rooms: list[RoomGrid]


# ── Branch-wise (Department-wise) Summary Schemas ─────────────────────────────

class BranchHallAllocation(BaseModel):
    room_id: int
    room_name: str
    invigilator_name: str | None
    invigilator2_name: str | None = None
    invigilator1_subject: str | None = None
    invigilator2_subject: str | None = None
    student_count: int
    roll_range: str
    roll_numbers: list[str]
    seats: list[str]


class BranchSummaryItem(BaseModel):
    department_id: int
    department_code: str
    department_name: str
    subject: str
    total_students: int
    halls: list[BranchHallAllocation]


class HallBranchItem(BaseModel):
    department_id: int
    department_code: str
    department_name: str
    student_count: int
    roll_range: str


class HallSummaryItem(BaseModel):
    room_id: int
    room_name: str
    invigilator_name: str | None
    capacity: int
    total_seated: int
    utilization_pct: float
    branches: list[HallBranchItem]


class MatrixCell(BaseModel):
    student_count: int
    roll_range: str


class PlanBranchSummaryResponse(BaseModel):
    plan_id: int
    session_id: int
    total_assigned: int
    unseated_count: int
    warnings: list[str]
    departments: list[BranchSummaryItem]
    halls: list[HallSummaryItem]
    department_codes: list[str]
    room_names: list[str]
    matrix: dict[str, dict[str, MatrixCell]]
