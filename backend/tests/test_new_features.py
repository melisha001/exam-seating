"""
tests/test_new_features.py — Comprehensive tests for:
  1. Six halls capacity allocation with mixed bench types (1-seater, 2-seater, 3-seater).
  2. Standard seat labels A1, B1, C1.
  3. Arrear roll number handling and flag preservation.
  4. Endpoints: overall-pdf, overall-excel, save-changes, and per-hall exports.
"""

from datetime import date
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.department import Department
from app.models.room import Room
from app.models.exam_session import ExamSession
from app.models.exam_entry import ExamEntry
from app.models.seating_plan import SeatingPlan, SeatAssignment
from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.seating import generate_seating
from app.algorithm.roll_numbers import generate_rolls, expand_roll_range
from app.algorithm.labels import get_seat_label, parse_seat_label

client = TestClient(app)


def test_labels_standard_generation():
    # 1-seater bench: 3 cols -> bench 1=A1, bench 2=A2, bench 4=A4 (row 1, col 0)
    assert get_seat_label(row=0, col=0, seat_index=0, cols=3) == "A1"
    assert get_seat_label(row=0, col=1, seat_index=0, cols=3) == "A2"
    assert get_seat_label(row=1, col=0, seat_index=0, cols=3) == "A4"

    # 2-seater bench
    assert get_seat_label(row=0, col=0, seat_index=0, cols=4) == "A1"
    assert get_seat_label(row=0, col=0, seat_index=1, cols=4) == "B1"

    # 3-seater bench
    assert get_seat_label(row=0, col=0, seat_index=0, cols=4) == "A1"
    assert get_seat_label(row=0, col=0, seat_index=1, cols=4) == "B1"
    assert get_seat_label(row=0, col=0, seat_index=2, cols=4) == "C1"

    # Invert
    r, c, si = parse_seat_label("C1", cols=4)
    assert (r, c, si) == (0, 0, 2)
    r2, c2, si2 = parse_seat_label("B5", cols=4)
    assert (r2, c2, si2) == (1, 0, 1)


def test_arrear_roll_number_parsing():
    # Single roll number without roll_end
    single = generate_rolls("CSE", 1, roll_start="927621BCS055", roll_end=None)
    assert single == ["927621BCS055"]

    # Comma-separated roll numbers without roll_end
    multi = generate_rolls(
        "ECE",
        3,
        roll_start="927621BEC002, 927621BEC019, 927621BEC045",
        roll_end=None,
    )
    assert multi == ["927621BEC002", "927621BEC019", "927621BEC045"]

    # With exclusions
    multi_ex = generate_rolls(
        "ECE",
        2,
        roll_start="927621BEC002, 927621BEC019, 927621BEC045",
        roll_end=None,
        exclusions=["927621BEC019"],
    )
    assert multi_ex == ["927621BEC002", "927621BEC045"]


def test_three_seater_bench_labels():
    """Verify 3-seater benches allocate A1, B1, C1 properly."""
    r3 = RoomSpec(room_id=1, room_name="Hall 3S", rows=2, cols=2, seats_per_bench=3)
    depts = [
        DeptGroup(1, "CSE", "CS301", generate_rolls("CSE", 6)),
        DeptGroup(2, "IT", "IT301", generate_rolls("IT", 6)),
    ]
    res = generate_seating(depts, [r3], check_front_back=False)
    assert len(res.room_results) == 1
    seats = res.room_results[0].seats
    # Seats on bench 1 (row 0, col 0)
    bench1 = [s for s in seats if s.row == 0 and s.col == 0]
    bench1_labels = [s.seat_label for s in bench1]
    assert bench1_labels == ["A1", "B1", "C1"]
    # Seats on bench 2 (row 0, col 1)
    bench2 = [s for s in seats if s.row == 0 and s.col == 1]
    bench2_labels = [s.seat_label for s in bench2]
    assert bench2_labels == ["A2", "B2", "C2"]


def test_six_halls_mixed_benches_allocation():
    """
    Test generating seating across 6 halls with equal distribution
    and auto-fitted capacities.
    """
    from app.algorithm.seating import get_hall_targets
    targets = get_hall_targets(175, 6)
    assert targets == [30, 29, 29, 29, 29, 29]

    rooms = []
    for i, t in enumerate(targets, 1):
        if t == 30:
            rooms.append(RoomSpec(i, f"Hall {i}", 3, 5, 2))
        else:
            # 14 benches of 2S, 1 bench of 1S = 29 seats
            cfg = {"2-4": 1}
            rooms.append(RoomSpec(i, f"Hall {i}", 3, 5, 2, bench_config=cfg))


    # 5 departments, 35 candidates each = 175 candidates total
    depts = [
        DeptGroup(1, "CSE", "CS301", generate_rolls("CSE", 35), is_arrear=False),
        DeptGroup(2, "IT", "IT301", generate_rolls("IT", 35), is_arrear=False),
        DeptGroup(3, "ECE", "EC301", generate_rolls("ECE", 35), is_arrear=False),
        DeptGroup(4, "EEE", "EE301", generate_rolls("EEE", 35), is_arrear=False),
        DeptGroup(5, "MECH", "ME301", generate_rolls("MECH", 35), is_arrear=True),  # arrear group
    ]

    res = generate_seating(depts, rooms, check_front_back=True)
    assert res.total_assigned == 175
    assert res.unseated_count == 0

    # Ensure all 6 halls are 100% occupied with zero empty seats
    for i, r_res in enumerate(res.room_results):
        assert r_res.assigned == targets[i]
        assert r_res.capacity == targets[i]
        assert all(not s.is_empty for s in r_res.seats)

    # Check labels format: e.g. A1, B1
    for r_res in res.room_results:
        for s in r_res.seats:
            assert s.seat_label is not None
            assert s.seat_label[0] in ("A", "B", "C")
            assert s.seat_label[1:].isdigit()

    # Check arrear students have is_arrear=True
    mech_seats = [s for r_res in res.room_results for s in r_res.seats if s.dept_code == "MECH"]
    assert len(mech_seats) == 35
    for s in mech_seats:
        assert s.is_arrear is True


def test_api_endpoints_exports_and_locking():
    """
    Test API endpoints for:
    - Overall PDF export (3-column)
    - Overall Excel export (3-column)
    - Per-hall PDF & Excel exports with room_id query parameter
    - Save changes endpoint locking all seats
    """
    db = SessionLocal()
    unique_label = f"FULL_TEST_{uuid.uuid4().hex[:6]}"
    sess = ExamSession(date=date(2030, 6, 1), label=unique_label)
    db.add(sess)
    db.commit()
    db.refresh(sess)

    d1 = db.query(Department).filter_by(code="CSE").first()
    if not d1:
        d1 = Department(name="Computer Science", code="CSE")
        db.add(d1)
    d2 = db.query(Department).filter_by(code="ECE").first()
    if not d2:
        d2 = Department(name="Electronics", code="ECE")
        db.add(d2)
    db.commit()

    r1 = db.query(Room).filter_by(name="Hall 101").first()
    if not r1:
        r1 = Room(
            name="Hall 101",
            rows=2,
            columns=2,
            seats_per_bench=2,
            invigilator_name="Dr. Smith",
            invigilator1_subject="CS101",
            invigilator2_name="Prof. John",
            invigilator2_subject="EC101",
        )
        db.add(r1)
        db.commit()
        db.refresh(r1)

    entry1 = ExamEntry(
        session_id=sess.id,
        department_id=d1.id,
        subject="Algorithms",
        subject_code="CS101",
        student_count=4,
        roll_start="21CS001",
        roll_end="21CS004",
        is_arrear=False,
    )
    entry2 = ExamEntry(
        session_id=sess.id,
        department_id=d2.id,
        subject="Signals",
        subject_code="EC101",
        student_count=4,
        roll_start="21EC001",
        roll_end="21EC004",
        is_arrear=True,
    )
    db.add_all([entry1, entry2])
    db.commit()

    # Generate plan via API
    gen_res = client.post(
        "/api/v1/plans/generate",
        json={"session_id": sess.id, "room_ids": [r1.id], "check_front_back": False},
    )
    assert gen_res.status_code == 201, gen_res.text
    plan_data = gen_res.json()
    plan_id = plan_data["plan_id"]

    # 1. Overall PDF Export
    pdf_res = client.get(f"/api/v1/plans/{plan_id}/export/overall-pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 500

    # 2. Overall Excel Export
    excel_res = client.get(f"/api/v1/plans/{plan_id}/export/overall-excel")
    assert excel_res.status_code == 200
    assert "spreadsheetml" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 500

    # 3. Single-hall PDF Export
    hall_pdf_res = client.get(f"/api/v1/plans/{plan_id}/export/pdf?room_id={r1.id}")
    assert hall_pdf_res.status_code == 200
    assert hall_pdf_res.headers["content-type"] == "application/pdf"
    assert f"room_{r1.id}" in hall_pdf_res.headers["content-disposition"]

    # 4. Single-hall Excel Export
    hall_excel_res = client.get(f"/api/v1/plans/{plan_id}/export/excel?room_id={r1.id}")
    assert hall_excel_res.status_code == 200
    assert "spreadsheetml" in hall_excel_res.headers["content-type"]
    assert f"room_{r1.id}" in hall_excel_res.headers["content-disposition"]

    # 5. Save Changes Endpoint (Seat locking)
    lock_res = client.post(f"/api/v1/plans/{plan_id}/save-changes", json={})
    assert lock_res.status_code == 200
    assert "saved and locked" in lock_res.json()["message"]

    # Verify that seats in DB are actually locked
    seats = db.query(SeatAssignment).filter_by(plan_id=plan_id).all()
    assert len(seats) > 0
    for s in seats:
        assert s.is_locked is True

    # Clean up test session
    client.delete(f"/api/v1/sessions/{sess.id}")
    db.close()
