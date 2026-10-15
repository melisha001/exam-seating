"""
tests/test_fixed_layouts_and_one_seater.py

Comprehensive tests verifying:
1. 1-seater bench support & mixed 1S, 2S, 3S layouts.
2. Layout immutability (zero mutation to rows, cols, or bench_config).
3. Hamilton proportional student distribution & maximum occupancy.
4. Partial occupancy (N < C): unused seats strictly at the end, partial bench retains seater type.
5. Shortage blocking (N > C): error Short by X seats.
6. Validation gate: 6 integrity checks.
7. PDF and Excel export generation with seater breakdown in hall header.
"""

import json
import pytest
from app.algorithm.models import RoomSpec, DeptGroup
from app.algorithm.seating import (
    generate_seating,
    get_hall_targets,
    validate_hall_capacities,
    validate_grid,
    validate_seating_result,
)
from app.algorithm.labels import get_seater_breakdown
from app.models.room import Room
from app.models.seating_plan import SeatingPlan, SeatAssignment
from app.services.export_pdf import generate_pdf
from app.services.export_excel import generate_excel


def test_seater_breakdown_generator():
    """Verify get_seater_breakdown generates expected strings for uniform and mixed halls."""
    # All 1-seaters
    b1 = get_seater_breakdown(5, 4, 1, None)
    assert b1 == "All 1-Seaters"

    # All 2-seaters
    b2 = get_seater_breakdown(4, 5, 2, None)
    assert b2 == "All 2-Seaters"

    # All 3-seaters
    b3 = get_seater_breakdown(3, 4, 3, None)
    assert b3 == "All 3-Seaters"

    # Mixed layout
    cfg = {"0-0": 1, "0-1": 2, "0-2": 3, "1-0": 1, "1-1": 2, "1-2": 3}
    bmixed = get_seater_breakdown(2, 3, 2, json.dumps(cfg))
    # 2 of 3S, 2 of 2S, 2 of 1S
    assert "3S x 2" in bmixed
    assert "2S x 2" in bmixed
    assert "1S x 2" in bmixed


def test_mixed_one_two_three_seater_hall_allocation():
    """Verify hall with mixed 1S, 2S, and 3S benches is allocated with zero violations."""
    # 2 rows x 3 columns:
    # Row 0: 1S (1), 2S (2), 3S (3) -> 6 seats
    # Row 1: 3S (3), 2S (2), 1S (1) -> 6 seats
    # Total = 12 seats
    cfg = {
        "0-0": 1, "0-1": 2, "0-2": 3,
        "1-0": 3, "1-1": 2, "1-2": 1,
    }
    room = RoomSpec(
        room_id=1,
        room_name="Hall Mixed 1-2-3",
        rows=2,
        cols=3,
        seats_per_bench=2,
        bench_config=json.dumps(cfg),
    )
    assert room.capacity == 12
    assert "1S x 2" in room.seater_breakdown
    assert "2S x 2" in room.seater_breakdown
    assert "3S x 2" in room.seater_breakdown

    groups = [
        DeptGroup(
            dept_id=1,
            dept_code="ECE",
            subject="Signals",
            subject_code="EC301",
            rolls=[f"ECE{i:02d}" for i in range(1, 5)],
        ),
        DeptGroup(
            dept_id=2,
            dept_code="MECH",
            subject="Thermo",
            subject_code="ME301",
            rolls=[f"MECH{i:02d}" for i in range(1, 5)],
        ),
        DeptGroup(
            dept_id=3,
            dept_code="CSE",
            subject="Algorithms",
            subject_code="CS301",
            rolls=[f"CSE{i:02d}" for i in range(1, 5)],
        ),
    ]

    result = generate_seating(groups, [room])
    assert result.total_assigned == 12
    assert result.unseated_count == 0

    hall_result = result.rooms[0]
    seated_seats = [s for s in hall_result.seats if not s.is_empty]
    assert len(seated_seats) == 12

    # Validation gate
    report = validate_grid(hall_result.seats, room, expected_count=12)
    assert report.is_valid is True
    assert report.checklist["fixed_layouts_unchanged"] is True
    assert report.checklist["no_unexpected_empty_seats"] is True
    assert report.checklist["no_same_subject_left_right"] is True
    assert report.checklist["no_same_subject_diagonal"] is True
    assert report.checklist["all_students_seated_once"] is True


def test_layout_immutability_zero_mutation():
    """Verify that generate_seating NEVER mutates room dimensions or bench_config."""
    cfg = {"0-0": 1, "0-1": 2, "0-2": 3, "1-0": 2, "1-1": 2, "1-2": 2}
    cfg_json = json.dumps(cfg)
    room = RoomSpec(
        room_id=1,
        room_name="Immutable Hall",
        rows=2,
        cols=3,
        seats_per_bench=2,
        bench_config=cfg_json,
    )

    initial_rows = room.rows
    initial_cols = room.cols
    initial_spb = room.seats_per_bench
    initial_cfg = room.bench_config
    initial_cap = room.capacity

    groups = [
        DeptGroup(
            dept_id=1,
            dept_code="ECE",
            subject="DSP",
            subject_code="EC401",
            rolls=[f"ECE{i:02d}" for i in range(1, 7)],
        ),
        DeptGroup(
            dept_id=2,
            dept_code="CSE",
            subject="Networks",
            subject_code="CS401",
            rolls=[f"CSE{i:02d}" for i in range(1, 7)],
        ),
    ]

    result = generate_seating(groups, [room])

    # Assert zero mutation
    assert room.rows == initial_rows
    assert room.cols == initial_cols
    assert room.seats_per_bench == initial_spb
    assert room.bench_config == initial_cfg
    assert room.capacity == initial_cap
    assert result.rooms[0].capacity == initial_cap


def test_partial_occupancy_unused_seats_at_end():
    """When N < C, unused seats must be placed strictly at the end of the hall."""
    # Hall capacity = 12 (3 rows x 2 cols x 2 seats/bench)
    room = RoomSpec(
        room_id=1,
        room_name="Hall A",
        rows=3,
        cols=2,
        seats_per_bench=2,
        bench_config=None,
    )
    assert room.capacity == 12

    # N = 10 students (< 12) -> 2 seats should stay unused at the end
    groups = [
        DeptGroup(
            dept_id=1,
            dept_code="ECE",
            subject="Math",
            subject_code="MA101",
            rolls=[f"ECE{i:02d}" for i in range(1, 6)],
        ),
        DeptGroup(
            dept_id=2,
            dept_code="MECH",
            subject="Physics",
            subject_code="PH101",
            rolls=[f"MECH{i:02d}" for i in range(1, 6)],
        ),
    ]

    result = generate_seating(groups, [room])
    assert result.total_assigned == 10
    hall = result.rooms[0]

    # Exactly 2 unused seats
    unused_seats = [s for s in hall.seats if s.is_empty]
    assert len(unused_seats) == 2

    # In reading order (row, col, seat_index), the unused seats must be the last two positions:
    sorted_seats = sorted(hall.seats, key=lambda s: (s.row, s.col, s.seat_index))
    for i in range(10):
        assert not sorted_seats[i].is_empty, f"Seat {i} should be occupied"
        assert sorted_seats[i].roll_number is not None
    for i in range(10, 12):
        assert sorted_seats[i].is_empty, f"Seat {i} should be unused"
        assert sorted_seats[i].roll_number is None

    # Validation gate
    report = validate_grid(hall.seats, room, expected_count=10)
    assert report.is_valid is True
    assert report.checklist["no_unexpected_empty_seats"] is True


def test_shortage_blocking_when_n_greater_than_c():
    """When N > C, validate_hall_capacities blocks generation with short-by-X error."""
    room = RoomSpec(room_id=1, room_name="Small Hall", rows=2, cols=2, seats_per_bench=2, bench_config=None)
    assert room.capacity == 8

    # 10 students > 8 seats -> short by 2
    groups = [
        DeptGroup(
            dept_id=1,
            dept_code="ECE",
            subject="Math",
            rolls=[f"ECE{i:02d}" for i in range(1, 11)],
        )
    ]
    errors = validate_hall_capacities(groups, [room])
    assert len(errors) > 0
    assert "Short by 2 seats. Add a hall or edit benches in Halls & Depts." in errors[0]

    with pytest.raises(ValueError) as exc:
        generate_seating(groups, [room])
    assert "Short by 2 seats. Add a hall or edit benches in Halls & Depts." in str(exc.value)


def test_hamilton_largest_remainder_distribution():
    """Verify Hamilton proportional distribution ensures occupancy % differs by at most 5%."""
    # Hall 1: cap 60, Hall 2: cap 40, Hall 3: cap 20 -> Total 120
    # N = 84 students (70% overall occupancy)
    h1 = RoomSpec(room_id=1, room_name="H1", rows=10, cols=3, seats_per_bench=2, bench_config=None)
    h2 = RoomSpec(room_id=2, room_name="H2", rows=10, cols=2, seats_per_bench=2, bench_config=None)
    h3 = RoomSpec(room_id=3, room_name="H3", rows=5, cols=2, seats_per_bench=2, bench_config=None)
    rooms = [h1, h2, h3]
    assert [r.capacity for r in rooms] == [60, 40, 20]

    targets = get_hall_targets(total_students=84, rooms=rooms)
    assert sum(targets) == 84
    # Expected: 60 * 84 / 120 = 42, 40 * 84 / 120 = 28, 20 * 84 / 120 = 14
    assert targets == [42, 28, 14]

    # Occupancy %
    pcts = [t / c * 100 for t, c in zip(targets, [60, 40, 20])]
    assert all(abs(p - 70.0) < 0.1 for p in pcts)


def test_exports_with_seater_breakdown():
    """Verify PDF and Excel exports run cleanly and include seater breakdown."""
    room_orm = Room(
        id=1,
        name="Hall Alpha",
        rows=2,
        columns=3,
        seats_per_bench=2,
        bench_config=json.dumps({"0-0": 1, "0-1": 2, "0-2": 3, "1-0": 1, "1-1": 2, "1-2": 3}),
        invigilator_name="Dr. Smith",
    )
    plan_orm = SeatingPlan(id=1, session_id=1)

    seats = []
    # 12 seats total
    labels = ["A1", "A2", "B2", "A3", "B3", "C3", "A4", "A5", "B5", "A6", "B6", "C6"]
    idx = 0
    for r in range(2):
        for c in range(3):
            seats_on_bench = room_orm.get_bench_seats(r, c)
            for si in range(seats_on_bench):
                seats.append(SeatAssignment(
                    id=idx + 1,
                    plan_id=1,
                    room_id=1,
                    row=r,
                    col=c,
                    seat_index=si,
                    seat_label=labels[idx],
                    roll_number=f"21CS{idx+1:03d}",
                    department_id=1,
                    subject="CS101",
                    subject_code="CS101",
                    medium="EN",
                    is_empty=False,
                ))
                idx += 1

    seats_by_room = {1: seats}

    # Generate PDF
    pdf_bytes = generate_pdf(plan_orm, [room_orm], seats_by_room)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")

    # Generate Excel
    excel_bytes = generate_excel(plan_orm, [room_orm], seats_by_room)
    assert len(excel_bytes) > 0
    assert excel_bytes.startswith(b"PK")  # ZIP header for xlsx
