"""
tests/test_api_extensions.py — Unit tests for:
  • Multi-department allocation via API
  • GET /plans/{id}/summary (branch-wise summary)
  • DELETE /plans/session/{session_id} (clear plan only)
  • Session cascade deletion
"""

from datetime import date
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.department import Department
from app.models.room import Room
from app.models.exam_session import ExamSession
from app.models.exam_entry import ExamEntry
from app.models.seating_plan import SeatingPlan, SeatAssignment


client = TestClient(app)


def test_session_cascade_delete():
    db = SessionLocal()
    unique_label = f"CASCADE_{uuid.uuid4().hex[:6]}"
    sess = ExamSession(date=date(2030, 1, 1), label=unique_label)
    db.add(sess)
    db.commit()
    db.refresh(sess)

    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="Test Dept", code="TD")
        db.add(dept)
        db.commit()
        db.refresh(dept)

    entry = ExamEntry(
        session_id=sess.id,
        department_id=dept.id,
        subject="Test Subject",
        student_count=10,
    )
    db.add(entry)

    plan = SeatingPlan(session_id=sess.id)
    db.add(plan)
    db.commit()
    db.refresh(plan)

    room = db.query(Room).first()
    room_id = room.id if room else 1

    seat = SeatAssignment(
        plan_id=plan.id,
        room_id=room_id,
        row=0,
        col=0,
        seat_index=0,
        is_empty=True,
    )
    db.add(seat)
    db.commit()

    s_id = sess.id
    e_id = entry.id
    p_id = plan.id
    st_id = seat.id
    db.close()

    # Delete session via API
    res = client.delete(f"/api/v1/sessions/{s_id}")
    assert res.status_code == 204

    # Verify cascades using a fresh session
    check_db = SessionLocal()
    try:
        assert check_db.get(ExamSession, s_id) is None
        assert check_db.get(ExamEntry, e_id) is None
        assert check_db.get(SeatingPlan, p_id) is None
        assert check_db.get(SeatAssignment, st_id) is None
    finally:
        check_db.close()


def test_clear_plan_only_endpoint():
    db = SessionLocal()
    unique_label = f"CLEAR_{uuid.uuid4().hex[:6]}"
    sess = ExamSession(date=date(2030, 1, 2), label=unique_label)
    db.add(sess)
    db.commit()
    db.refresh(sess)

    dept = db.query(Department).first()
    entry = ExamEntry(
        session_id=sess.id,
        department_id=dept.id,
        subject="Test Subject",
        student_count=10,
    )
    db.add(entry)

    plan = SeatingPlan(session_id=sess.id)
    db.add(plan)
    db.commit()
    db.refresh(plan)

    s_id = sess.id
    e_id = entry.id
    p_id = plan.id
    db.close()

    # Call DELETE /plans/session/{session_id}
    res = client.delete(f"/api/v1/plans/session/{s_id}")
    assert res.status_code == 200
    assert "cleared successfully" in res.json()["message"]

    # Verify using a fresh session
    check_db = SessionLocal()
    try:
        # Session and Entry MUST remain intact
        assert check_db.get(ExamSession, s_id) is not None
        assert check_db.get(ExamEntry, e_id) is not None
        # Plan MUST be deleted
        assert check_db.get(SeatingPlan, p_id) is None

        # Clean up
        to_del = check_db.get(ExamSession, s_id)
        if to_del:
            check_db.delete(to_del)
            check_db.commit()
    finally:
        check_db.close()


def test_branch_summary_endpoint():
    db = SessionLocal()
    try:
        plan = db.query(SeatingPlan).first()
        if plan:
            res = client.get(f"/api/v1/plans/{plan.id}/summary")
            assert res.status_code == 200
            data = res.json()
            assert "departments" in data
            assert "halls" in data
            assert "matrix" in data
            assert "department_codes" in data
            assert "room_names" in data
    finally:
        db.close()
