"""
schemas/room.py — Pydantic request/response schemas for Room.
"""

from pydantic import BaseModel, Field, computed_field


class RoomBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Hall A"])
    rows: int = Field(..., gt=0, examples=[10])
    columns: int = Field(..., gt=0, examples=[6])
    seats_per_bench: int = Field(2, ge=1, le=3, examples=[2])
    invigilator_name: str | None = Field(None, max_length=150, examples=["Dr. Smith"])
    invigilator2_name: str | None = Field(None, max_length=150, examples=["Prof. Jones"])
    invigilator1_subject: str | None = Field(None, max_length=150)
    invigilator2_subject: str | None = Field(None, max_length=150)
    bench_config: str | None = Field(None, description="JSON string mapping 'row-col' to seats count (1, 2, or 3)")
    seater_mode: str = Field("auto", description="Seater mode: 'auto' or 'manual'")


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    """All fields optional for PATCH-style updates."""
    name: str | None = Field(None, min_length=1, max_length=100)
    rows: int | None = Field(None, gt=0)
    columns: int | None = Field(None, gt=0)
    seats_per_bench: int | None = Field(None, ge=1, le=3)
    invigilator_name: str | None = None
    invigilator2_name: str | None = None
    invigilator1_subject: str | None = None
    invigilator2_subject: str | None = None
    bench_config: str | None = None
    seater_mode: str | None = None


class RoomRead(RoomBase):
    id: int
    capacity: int  # read directly from ORM model's @property via from_attributes=True
    seater_breakdown: str | None = None

    model_config = {"from_attributes": True}

