"""
schemas/exam_entry.py — Pydantic schemas for ExamEntry.
"""

from pydantic import BaseModel, Field, model_validator


class ExamEntryBase(BaseModel):
    session_id: int
    department_id: int
    subject: str = Field(..., min_length=1, max_length=200, examples=["Data Structures"])
    subject_code: str | None = Field(None, max_length=50, examples=["CS3301"])
    student_count: int = Field(..., gt=0, examples=[60])
    roll_start: str | None = Field(None, max_length=50, examples=["21CSE001"])
    roll_end: str | None = Field(None, max_length=50, examples=["21CSE060"])
    exclusions: str | None = Field(None, description="Comma-separated roll numbers excluded (absentees)")
    is_arrear: bool = Field(False, description="True for arrear candidates")
    medium: str = Field("EN", description="Medium of instruction: 'EN' or 'TA'")

    @model_validator(mode="after")
    def check_roll_range(self) -> "ExamEntryBase":
        """For regular entries, both roll_start and roll_end must be provided together, or neither.
        For arrear entries, roll_end is optional."""
        has_start = self.roll_start is not None and bool(self.roll_start.strip())
        has_end = self.roll_end is not None and bool(self.roll_end.strip())
        if not self.is_arrear and (has_start != has_end):
            raise ValueError(
                "Provide both roll_start and roll_end, or neither."
            )
        return self


class ExamEntryCreate(ExamEntryBase):
    pass


class ExamEntryUpdate(BaseModel):
    subject: str | None = Field(None, min_length=1, max_length=200)
    subject_code: str | None = Field(None, max_length=50)
    student_count: int | None = Field(None, gt=0)
    roll_start: str | None = None
    roll_end: str | None = None
    exclusions: str | None = None
    is_arrear: bool | None = None
    medium: str | None = None


class ExamEntryRead(ExamEntryBase):
    id: int

    model_config = {"from_attributes": True}
