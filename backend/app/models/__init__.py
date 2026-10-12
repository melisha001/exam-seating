# models/__init__.py
# Import all models so that SQLAlchemy metadata is populated
# when `Base.metadata.create_all()` is called in main.py.

from app.models.room import Room  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.exam_session import ExamSession  # noqa: F401
from app.models.exam_entry import ExamEntry  # noqa: F401
from app.models.seating_plan import SeatingPlan, SeatAssignment  # noqa: F401
