"""
schemas/department.py — Pydantic schemas for Department.
"""

from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, examples=["Computer Science and Engineering"])
    code: str = Field(..., min_length=1, max_length=20, examples=["CSE"])


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    code: str | None = Field(None, min_length=1, max_length=20)


class DepartmentRead(DepartmentBase):
    id: int

    model_config = {"from_attributes": True}
