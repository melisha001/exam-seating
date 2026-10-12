"""
schemas/plan_request.py — Request/response schemas for plan generation and swap.
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
    capacity: int
    assigned: int
    utilization_pct: float
    seats: list[dict]   # list of SeatAssignmentRead-compatible dicts

    model_config = {"from_attributes": True}


class PlanDetail(PlanSummary):
    """Full plan with per-room grids."""
    rooms: list[RoomGrid]
