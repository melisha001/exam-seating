# algorithm/__init__.py
from app.algorithm.seating import generate_seating
from app.algorithm.models import DeptGroup, RoomSpec, SeatingResult, RoomResult, SeatInfo

__all__ = [
    "generate_seating",
    "DeptGroup",
    "RoomSpec",
    "SeatingResult",
    "RoomResult",
    "SeatInfo",
]
