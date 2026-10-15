"""
schemas/seating_plan.py — Pydantic schemas for SeatingPlan and SeatAssignment.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class SeatAssignmentRead(BaseModel):
    id: int
    plan_id: int
    room_id: int
    row: int
    col: int
    seat_index: int
    roll_number: str | None
    department_id: int | None
    subject: str | None = None
    subject_code: str | None = None
    is_empty: bool = False
    is_arrear: bool = False
    is_locked: bool = False
    medium: str | None = "EN"
    seat_label: str = ""

    model_config = {"from_attributes": True}


class SeatingPlanRead(BaseModel):
    id: int
    session_id: int
    created_at: datetime
    warnings: list[str]
    unseated_count: int
    seat_assignments: list[SeatAssignmentRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SwapRequest(BaseModel):
    """Request body for manually swapping two seats."""
    seat_id_a: int = Field(..., description="ID of the first SeatAssignment")
    seat_id_b: int = Field(..., description="ID of the second SeatAssignment")
