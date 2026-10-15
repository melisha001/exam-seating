"""
tests/test_new_workflow.py — Comprehensive unit tests for AutoSeat Pro fixed layouts:
  1. Equal split with remainder (e.g. 100 students, 3 halls -> 34/33/33)
  2. Mixed 2-seater and 3-seater halls
  3. 3 subjects allocation
  4. Uneven subject counts
  5. Only 2 subjects allocation
  6. Dominant subject (warning case when one subject has >50% students)
  7. Hamilton proportional distribution across halls
  8. Blocked generation when capacity is short (N > C)
"""

import pytest
from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.seating import (
    generate_seating,
    get_hall_targets,
    validate_hall_capacities,
    distribute_students_to_halls,
)


def _make_dept(dept_id: int, code: str, subject_code: str, count: int) -> DeptGroup:
    rolls = [f"{code}{i:03d}" for i in range(1, count + 1)]
    return DeptGroup(
        dept_id=dept_id,
        dept_code=code,
        subject=subject_code,
        subject_code=subject_code,
        rolls=rolls,
    )


# 1. Equal split with remainder (e.g. 100 students, 3 halls -> 34/33/33)
def test_equal_split_with_remainder():
    # 100 students across 3 halls
    targets = get_hall_targets(100, 3)
    assert targets == [34, 33, 33]

    depts = [
        _make_dept(1, "CSE", "CS301", 30),
        _make_dept(2, "ECE", "EC301", 30),
        _make_dept(3, "MECH", "ME301", 40),
    ]
    # Set up 3 fixed layout rooms matching 34, 33, 33
    # r1: 2 benches of 3S, 14 of 2S = 6 + 28 = 34
    r1_cfg = {f"{r}-{c}": 2 for r in range(4) for c in range(4)}
    r1_cfg["0-0"] = 3
    r1_cfg["0-1"] = 3

    # r2: 1 bench of 3S, 15 of 2S = 3 + 30 = 33
    r2_cfg = {f"{r}-{c}": 2 for r in range(4) for c in range(4)}
    r2_cfg["0-0"] = 3

    # r3: 1 bench of 3S, 15 of 2S = 3 + 30 = 33
    r3_cfg = {f"{r}-{c}": 2 for r in range(4) for c in range(4)}
    r3_cfg["0-0"] = 3

    rooms = [
        RoomSpec(1, "Hall 1", 4, 4, 2, bench_config=r1_cfg),
        RoomSpec(2, "Hall 2", 4, 4, 2, bench_config=r2_cfg),
        RoomSpec(3, "Hall 3", 4, 4, 2, bench_config=r3_cfg),
    ]

    res = generate_seating(depts, rooms)
    assert res.total_assigned == 100
    assert res.unseated_count == 0
    assigned_counts = [r.assigned for r in res.room_results]
    assert assigned_counts == [34, 33, 33]

    # Every seat must be occupied (zero empty seats)
    for r_res in res.room_results:
        assert all(not s.is_empty for s in r_res.seats)
        assert r_res.assigned == r_res.capacity


# 2. Mixed 2-seater and 3-seater halls
def test_mixed_two_and_three_seater_halls():
    # Hall with 16 benches: 6 of 3-seaters, 10 of 2-seaters = 18 + 20 = 38
    cfg = {f"{r}-{c}": 2 for r in range(4) for c in range(4)}
    for idx, (r, c) in enumerate([(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1)]):
        cfg[f"{r}-{c}"] = 3

    room = RoomSpec(1, "Mixed Hall", 4, 4, 2, bench_config=cfg)
    assert room.capacity == 38

    depts = [
        _make_dept(1, "CSE", "CS101", 19),
        _make_dept(2, "IT", "IT101", 19),
    ]
    res = generate_seating(depts, [room])
    assert res.total_assigned == 38
    assert res.unseated_count == 0
    assert all(not s.is_empty for s in res.room_results[0].seats)
    assert res.room_results[0].assigned == 38


# 3. 3 subjects allocation
def test_three_subjects_allocation():
    depts = [
        _make_dept(1, "CSE", "CS401", 20),
        _make_dept(2, "ECE", "EC401", 20),
        _make_dept(3, "MECH", "ME401", 20),
    ]
    room = RoomSpec(1, "Hall A", rows=5, cols=6, seats_per_bench=2)  # 60 seats

    res = generate_seating(depts, [room])
    assert res.total_assigned == 60
    assert res.unseated_count == 0

    # Verify no horizontal adjacency violations
    seats = res.room_results[0].seats
    row_map = {}
    for s in seats:
        row_map.setdefault(s.row, []).append(s)
    for r, r_seats in row_map.items():
        r_seats.sort(key=lambda s: (s.col, s.seat_index))
        for i in range(len(r_seats) - 1):
            assert r_seats[i].subject_code != r_seats[i + 1].subject_code, (
                f"Row {r}: {r_seats[i].seat_label} and {r_seats[i+1].seat_label} share {r_seats[i].subject_code}"
            )


# 4. Uneven subject counts
def test_uneven_subject_counts():
    depts = [
        _make_dept(1, "CSE", "CS501", 28),
        _make_dept(2, "ECE", "EC501", 14),
        _make_dept(3, "CIVIL", "CE501", 8),
    ]
    total = 28 + 14 + 8  # 50 students
    room = RoomSpec(1, "Hall Uneven", rows=5, cols=5, seats_per_bench=2)  # 50 seats

    res = generate_seating(depts, [room])
    assert res.total_assigned == 50
    assert res.unseated_count == 0
    assert all(not s.is_empty for s in res.room_results[0].seats)


# 5. Only 2 subjects allocation
def test_only_two_subjects():
    depts = [
        _make_dept(1, "CSE", "CS201", 20),
        _make_dept(2, "ECE", "EC201", 20),
    ]
    room = RoomSpec(1, "Hall TwoSubj", rows=4, cols=5, seats_per_bench=2)  # 40 seats

    res = generate_seating(depts, [room])
    assert res.total_assigned == 40
    assert res.unseated_count == 0

    # In 2-subject setup, students must strictly alternate horizontally
    row_map = {}
    for s in res.room_results[0].seats:
        row_map.setdefault(s.row, []).append(s)
    for r, r_seats in row_map.items():
        r_seats.sort(key=lambda s: (s.col, s.seat_index))
        for i in range(len(r_seats) - 1):
            assert r_seats[i].subject_code != r_seats[i + 1].subject_code


# 6. Dominant subject (warning case when one subject has >50% of candidates)
def test_dominant_subject_warning_case():
    # 30 of CS999 and only 10 of EC999 in a 40-seat room (75% dominant)
    depts = [
        _make_dept(1, "CSE", "CS999", 30),
        _make_dept(2, "ECE", "EC999", 10),
    ]
    room = RoomSpec(1, "Hall Dominant", rows=4, cols=5, seats_per_bench=2)

    res = generate_seating(depts, [room])
    assert res.total_assigned == 40
    # Must report warnings for the unavoidable conflicts
    assert len(res.warnings) > 0
    assert any("conflict" in w.lower() or "violation" in w.lower() or "CS999" in w for w in res.warnings)
    # Zero empty seats: all 40 students are seated
    assert all(not s.is_empty for s in res.room_results[0].seats)


# 7. Hamilton proportional distribution across halls
def test_hamilton_proportional_distribution():
    # 3 halls with capacities 20, 30, 50. Total capacity = 100.
    # Total students = 60.
    # Hamilton quota: 60 * 20/100 = 12, 60 * 30/100 = 18, 60 * 50/100 = 30.
    r1 = RoomSpec(1, "H1", 2, 5, 2)  # cap 20
    r2 = RoomSpec(2, "H2", 3, 5, 2)  # cap 30
    r3 = RoomSpec(3, "H3", 5, 5, 2)  # cap 50
    targets = get_hall_targets(60, 3, [r1, r2, r3])
    assert targets == [12, 18, 30]


# 8. Blocked generation when capacity is short (N > C)
def test_blocked_generation_when_capacity_short():
    depts = [
        _make_dept(1, "CSE", "CS101", 35),
        _make_dept(2, "ECE", "EC101", 35),
    ]
    # Total 70 students, 1 hall with 60 seats (short by 10)
    room = RoomSpec(1, "Hall D", rows=6, cols=5, seats_per_bench=2)  # capacity = 60
    assert room.capacity == 60

    errors = validate_hall_capacities(depts, [room])
    assert len(errors) == 1
    assert "Short by 10 seats" in errors[0]

    with pytest.raises(ValueError) as excinfo:
        generate_seating(depts, [room])
    assert "Generation blocked" in str(excinfo.value)
    assert "Short by 10 seats" in str(excinfo.value)
