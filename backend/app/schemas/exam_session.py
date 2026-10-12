"""
schemas/exam_session.py — Pydantic schemas for ExamSession.
"""

from datetime import date as Date_

from pydantic import BaseModel, Field


class ExamSessionBase(BaseModel):
    date: Date_ = Field(..., examples=["2025-05-15"])
    label: str = Field(..., min_length=1, max_length=50, examples=["FN"])


class ExamSessionCreate(ExamSessionBase):
    pass


class ExamSessionUpdate(BaseModel):
    date: Date_ | None = None
    label: str | None = Field(None, min_length=1, max_length=50)


class ExamSessionRead(ExamSessionBase):
    id: int

    model_config = {"from_attributes": True}
