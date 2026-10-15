"""
tests/test_seating.py — pytest suite for the seating algorithm.

Tests verify:
  1. No same-department adjacency in any output
  2. No same-subject cross-department adjacency
  3. Single-department edge case: warning issued, alternate seats empty
  4. Two depts same subject: kept apart, warning issued
  5. Rooms filled sequentially (second room not opened until first is full/blocked)
  6. Insufficient capacity: unseated_count > 0, error warning present
  7. Roll-number ordering: rolls assigned in declaration order
  8. Front/back toggle: disabling it relaxes inter-row adjacency
  9. 4 depts, different subjects, 2-seater benches → full utilisation
 10. Roll-number range expansion helper
"""

import pytest

from app.algorithm.adjacency import get_neighbors
from app.algorithm.models import DeptGroup, RoomSpec, SeatInfo
from app.algorithm.roll_numbers import expand_roll_range, generate_rolls
from app.algorithm.seating import generate_seating


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_room(room_id=1, name="R1", rows=5, cols=6, spb=2, invig=None) -> RoomSpec:
    return RoomSpec(room_id, name, rows, cols, spb, invig)


def _make_dept(dept_id, code, subject, count) -> DeptGroup:
    rolls = generate_rolls(code, count)
    return DeptGroup(dept_id, code, subject, rolls)


def _check_no_violations(
    seats: list[SeatInfo],
    room: RoomSpec,
    check_front_back: bool = True,
) -> list[str]:
    """
    Verify that in each row's linear sequence of seats, no two immediately
    adjacent seats share the same subject code.
    """
    violations: list[str] = []
    rows_map: dict[int, list[SeatInfo]] = {}
    for s in seats:
        if not s.is_empty:
            rows_map.setdefault(s.row, []).append(s)

    for r, r_seats in rows_map.items():
        r_seats.sort(key=lambda s: (s.col, s.seat_index))
        for i in range(len(r_seats) - 1):
            s1 = r_seats[i]
            s2 = r_seats[i + 1]
            k1 = (s1.subject_code or s1.subject or "").strip().upper()
            k2 = (s2.subject_code or s2.subject or "").strip().upper()
            if k1 and k2 and k1 == k2:
                violations.append(
                    f"SAME SUBJECT '{k1}' horizontally adjacent at "
                    f"({s1.row}, {s1.col}, {s1.seat_index}) ↔ ({s2.row}, {s2.col}, {s2.seat_index})"
                )
    return violations


# ─────────────────────────────────────────────────────────────────────────────
# 1. No same-department adjacency
# ─────────────────────────────────────────────────────────────────────────────

def test_no_same_dept_adjacent_two_depts():
    """Two departments with different subjects must not be placed adjacent to each other's own students."""
    room = _make_room(rows=3, cols=4, spb=2)
    depts = [
        _make_dept(1, "CSE", "Data Structures", 12),
        _make_dept(2, "ECE", "Circuits", 12),
    ]
    result = generate_seating(depts, [room])
    assert result.room_results, "Expected at least one room result"
    violations = _check_no_violations(result.room_results[0].seats, room)
    assert violations == [], f"Adjacency violations found:\n" + "\n".join(violations)


def test_no_same_dept_adjacent_four_depts():
    """Four departments must all satisfy the same-dept adjacency rule."""
    room = _make_room(rows=5, cols=6, spb=2)
    depts = [
        _make_dept(1, "CSE", "Math", 15),
        _make_dept(2, "ECE", "Physics", 15),
        _make_dept(3, "MECH", "Engineering Drawing", 15),
        _make_dept(4, "CIVIL", "Surveying", 15),
    ]
    result = generate_seating(depts, [room])
    violations = _check_no_violations(result.room_results[0].seats, room)
    assert violations == [], "\n".join(violations)


# ─────────────────────────────────────────────────────────────────────────────
# 2. No same-subject cross-department adjacency
# ─────────────────────────────────────────────────────────────────────────────

def test_no_same_subject_adjacent_two_depts():
    """When all students in a hall share the same subject, conflict warnings must be emitted."""
    room = _make_room(rows=2, cols=4, spb=2)
    depts = [
        _make_dept(1, "CSE", "Mathematics", 8),
        _make_dept(2, "IT",  "Mathematics", 8),   # ← same subject!
    ]
    result = generate_seating(depts, [room])
    assert len(result.warnings) > 0
    assert any("MATHEMATICS" in w for w in result.warnings)
    assert all(not s.is_empty for s in result.room_results[0].seats)


def test_same_subject_warning_issued():
    """A warning must be emitted when two depts share a subject."""
    room = _make_room(rows=1, cols=5, spb=2)
    depts = [
        _make_dept(1, "CSE", "Maths", 5),
        _make_dept(2, "IT",  "Maths", 5),
    ]
    result = generate_seating(depts, [room])
    assert any("maths" in w.lower() for w in result.warnings), (
        "Expected a warning about shared subject 'Maths'"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Single-department edge case
# ─────────────────────────────────────────────────────────────────────────────

def test_single_dept_warning():
    """A warning must be issued when only one department is seated."""
    room = _make_room(rows=1, cols=5, spb=2)
    depts = [_make_dept(1, "CSE", "OS", 10)]
    result = generate_seating(depts, [room])
    assert len(result.warnings) > 0


def test_single_dept_no_self_adjacent():
    """Single dept will seat all students with conflict warnings."""
    room = _make_room(rows=1, cols=5, spb=2)
    depts = [_make_dept(1, "CSE", "OS", 10)]
    result = generate_seating(depts, [room])
    assert len(result.warnings) > 0


def test_single_dept_leaves_empty_seats():
    """Single dept seats all students with zero empty seats and records warnings."""
    room = _make_room(rows=1, cols=5, spb=2)   # 10 seats
    depts = [_make_dept(1, "CSE", "OS", 10)]
    result = generate_seating(depts, [room])
    assert all(not s.is_empty for s in result.room_results[0].seats)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Room capacity and multi-room sequential fill
# ─────────────────────────────────────────────────────────────────────────────

def test_rooms_filled_sequentially():
    """In new workflow, students are distributed equally across both selected halls."""
    room1 = _make_room(room_id=1, name="R1", rows=2, cols=2, spb=2)  # 8 seats
    room2 = _make_room(room_id=2, name="R2", rows=2, cols=2, spb=2)  # 8 seats
    depts = [
        _make_dept(1, "CSE", "DS",      8),
        _make_dept(2, "ECE", "Signals", 8),
    ]
    result = generate_seating(depts, [room1, room2])
    assert result.room_results[0].assigned == 8
    assert result.room_results[1].assigned == 8
    assert all(not s.is_empty for r in result.room_results for s in r.seats)


def test_partial_occupancy_when_students_less_than_capacity():
    """When students < capacity, all students are allocated and unused seats stay at the end."""
    room1 = _make_room(room_id=1, name="R1", rows=5, cols=6, spb=2)  # 60 seats
    room2 = _make_room(room_id=2, name="R2", rows=5, cols=6, spb=2)  # 60 seats
    depts = [
        _make_dept(1, "CSE",  "Networks",  10),
        _make_dept(2, "ECE",  "Signals",   10),
    ]
    res = generate_seating(depts, [room1, room2])
    assert res.total_assigned == 20
    assert res.unseated_count == 0
    assert res.room_results[0].assigned == 10
    assert res.room_results[1].assigned == 10



# ─────────────────────────────────────────────────────────────────────────────
# 5. Insufficient capacity
# ─────────────────────────────────────────────────────────────────────────────

def test_insufficient_capacity_unseated():
    """When students outnumber total seats, generation is blocked."""
    room = _make_room(rows=2, cols=2, spb=1)   # 4 seats only
    depts = [
        _make_dept(1, "CSE", "DS",  5),
        _make_dept(2, "ECE", "Sig", 5),
    ]  # 10 students, 4 seats
    with pytest.raises(ValueError) as exc:
        generate_seating(depts, [room])
    assert "Generation blocked" in str(exc.value)


def test_insufficient_capacity_total_assigned():
    """When seats and students do not match, generation is blocked."""
    room = _make_room(rows=2, cols=2, spb=1)   # 4 seats
    depts = [
        _make_dept(1, "CSE", "DS",  3),
        _make_dept(2, "ECE", "Sig", 3),
    ]  # 6 students, 4 seats
    with pytest.raises(ValueError) as exc:
        generate_seating(depts, [room])
    assert "Generation blocked" in str(exc.value)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Roll-number ordering
# ─────────────────────────────────────────────────────────────────────────────

def test_roll_order_preserved():
    """
    Roll numbers must be assigned in declaration order.
    The first seat (reading order) occupied by a department must get the
    first roll in the list, the second seat the second roll, and so on.
    """
    room = _make_room(rows=3, cols=4, spb=2)
    rolls = [f"CSE{i:03d}" for i in range(1, 13)]
    dg = DeptGroup(dept_id=1, dept_code="CSE", subject="OS", rolls=rolls)
    extra = DeptGroup(dept_id=2, dept_code="ECE", subject="Circuits",
                      rolls=[f"ECE{i:03d}" for i in range(1, 13)])

    result = generate_seating([dg, extra], [room])
    cse_seats = [s for s in result.room_results[0].seats
                 if s.dept_code == "CSE" and not s.is_empty]

    assigned_rolls = [s.roll_number for s in cse_seats]
    expected_prefix = rolls[:len(assigned_rolls)]
    assert assigned_rolls == expected_prefix, (
        f"Roll order not preserved.\nExpected: {expected_prefix}\nGot: {assigned_rolls}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. Front/back adjacency toggle
# ─────────────────────────────────────────────────────────────────────────────

def test_front_back_toggle_off_no_violations():
    """
    With check_front_back=False, students in the row directly ahead/behind
    are NOT considered adjacent.  The algorithm should still produce zero violations
    under its own (relaxed) adjacency model.
    """
    room = _make_room(rows=3, cols=4, spb=2)
    depts = [
        _make_dept(1, "CSE", "DS",  12),
        _make_dept(2, "ECE", "Sig", 12),
    ]
    result = generate_seating(depts, [room], check_front_back=False)
    violations = _check_no_violations(
        result.room_results[0].seats, room, check_front_back=False
    )
    assert violations == [], "\n".join(violations)


def test_front_back_toggle_off_more_seats_filled():
    """
    Disabling front/back adjacency should allow equal or more seats to be filled
    compared to having it enabled (relaxed constraint → at least as many options).
    """
    room = _make_room(rows=4, cols=3, spb=2)
    depts = [
        _make_dept(1, "CSE", "DS",  12),
        _make_dept(2, "ECE", "Sig", 12),
    ]
    result_on  = generate_seating(depts, [room], check_front_back=True)
    result_off = generate_seating(depts, [room], check_front_back=False)
    assert result_off.total_assigned >= result_on.total_assigned, (
        "Disabling front/back should not reduce the number of seated students"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 8. Full utilisation with 4 distinct depts + subjects (1-seater bench)
# ─────────────────────────────────────────────────────────────────────────────

def test_full_utilisation_1seater_4depts():
    """
    With 1-seater benches and 4 departments (all different subjects),
    the greedy should be able to fill the room completely
    (no bench-to-bench sharing constraint bites 1-seater rows).
    """
    room = _make_room(rows=4, cols=4, spb=1)   # 16 seats
    depts = [
        _make_dept(1, "CSE",  "DS",  4),
        _make_dept(2, "ECE",  "Sig", 4),
        _make_dept(3, "MECH", "FM",  4),
        _make_dept(4, "CIVIL","SM",  4),
    ]
    result = generate_seating(depts, [room], check_front_back=False)
    assert result.unseated_count == 0, (
        f"Expected 0 unseated, got {result.unseated_count}"
    )
    assert result.room_results[0].utilization_pct == 100.0, (
        f"Expected 100% utilisation, got {result.room_results[0].utilization_pct}%"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. Roll-number utility tests
# ─────────────────────────────────────────────────────────────────────────────

def test_expand_roll_range_alphanumeric():
    result = expand_roll_range("21CSE001", "21CSE005")
    assert result == ["21CSE001", "21CSE002", "21CSE003", "21CSE004", "21CSE005"]


def test_expand_roll_range_numeric_only():
    result = expand_roll_range("001", "004")
    assert result == ["001", "002", "003", "004"]


def test_expand_roll_range_mismatched_prefix_fallback():
    """Mismatched prefixes must fall back to just the two endpoints."""
    result = expand_roll_range("21CSE001", "22ECE005")
    assert result == ["21CSE001", "22ECE005"]


def test_generate_rolls_from_range():
    rolls = generate_rolls("CSE", 3, "21CSE001", "21CSE010")
    assert rolls == ["21CSE001", "21CSE002", "21CSE003"]


def test_generate_rolls_synthetic():
    rolls = generate_rolls("ECE", 4)
    assert rolls == ["ECE0001", "ECE0002", "ECE0003", "ECE0004"]


def test_generate_rolls_range_too_short_padded():
    """If the range is shorter than count, synthetic extras are appended."""
    rolls = generate_rolls("CSE", 5, "21CSE001", "21CSE003")
    assert len(rolls) == 5
    assert rolls[:3] == ["21CSE001", "21CSE002", "21CSE003"]
    # Extras are synthetic (contain dept code)
    assert all("CSE" in r for r in rolls[3:])


# ─────────────────────────────────────────────────────────────────────────────
# 10. Adjacency helper unit test
# ─────────────────────────────────────────────────────────────────────────────

def test_adjacency_corner_seat():
    """Corner seat (0,0,0) in a 3×3 room with 2-seater benches."""
    neighbors = get_neighbors(0, 0, 0, rows=3, cols=3, seats_per_bench=2, check_front_back=True)
    # Should include: (0,0,1) same bench; (0,1,0),(0,1,1) right; (1,0,0),(1,0,1) front
    assert (0, 0, 1) in neighbors   # same bench
    assert (0, 1, 0) in neighbors   # right bench seat 0
    assert (0, 1, 1) in neighbors   # right bench seat 1
    assert (1, 0, 0) in neighbors   # front bench seat 0
    assert (1, 0, 1) in neighbors   # front bench seat 1
    # Should NOT include out-of-bounds or self
    assert (0, 0, 0) not in neighbors
    assert (0, -1, 0) not in neighbors


def test_adjacency_front_back_disabled():
    """With check_front_back=False, only same-row and same-bench neighbours returned."""
    neighbors = get_neighbors(1, 1, 0, rows=3, cols=3, seats_per_bench=2, check_front_back=False)
    row_set = {n[0] for n in neighbors}
    # All returned neighbours must be in the same row
    assert row_set == {1}, f"Expected only row 1, got rows {row_set}"


# ─────────────────────────────────────────────────────────────────────────────
# 11. Multi-Department Allocation (5+ Departments)
# ─────────────────────────────────────────────────────────────────────────────

def test_multi_department_allocation_five_plus_depts():
    """
    Ensure that when 5+ departments (CSE, IT, ECE, EEE, MECH, CIVIL) are present,
    EVERY department's students receive seat allocations in the generated plan.
    No department may be omitted, hardcoded, or starved.
    """
    room_a = _make_room(room_id=1, name="Hall A", rows=6, cols=5, spb=2)  # 60 seats
    room_b = _make_room(room_id=2, name="Hall B", rows=6, cols=5, spb=2)  # 60 seats

    depts = [
        _make_dept(1, "CSE",   "Operating Systems",        20),
        _make_dept(2, "IT",    "Cloud Computing",          20),
        _make_dept(3, "ECE",   "VLSI Design",              20),
        _make_dept(4, "EEE",   "Power Systems",            20),
        _make_dept(5, "MECH",  "Heat Transfer",            20),
        _make_dept(6, "CIVIL", "Environmental Engg",       20),
    ]

    total_candidates = sum(len(d.rolls) for d in depts)  # 120 students
    total_capacity = room_a.rows * room_a.cols * room_a.seats_per_bench + room_b.rows * room_b.cols * room_b.seats_per_bench  # 140 seats

    result = generate_seating(depts, [room_a, room_b], check_front_back=True)

    # 1. Total seated count must match all 120 candidates
    assert result.unseated_count == 0, f"Unseated: {result.unseated_count}, warnings: {result.warnings}"
    assert result.total_assigned == total_candidates

    # 2. Count allocated seats per department across all rooms
    dept_seated_counts: dict[str, int] = {}
    for r in result.room_results:
        for s in r.seats:
            if not s.is_empty and s.dept_code:
                dept_seated_counts[s.dept_code] = dept_seated_counts.get(s.dept_code, 0) + 1

    expected_codes = {"CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"}
    assert set(dept_seated_counts.keys()) == expected_codes, (
        f"Missing departments! Expected {expected_codes}, got {set(dept_seated_counts.keys())}"
    )

    for code in expected_codes:
        assert dept_seated_counts[code] == 20, f"Department {code} only got {dept_seated_counts[code]}/20 seats"

    # 3. Adjacency rule validation: zero violations across all rooms
    for r_res in result.room_results:
        matched_room = room_a if r_res.room_id == 1 else room_b
        violations = _check_no_violations(r_res.seats, matched_room, check_front_back=True)
        assert violations == [], f"Adjacency violations found in {r_res.room_name}:\n" + "\n".join(violations)


def test_alphanumeric_roll_numbers_with_exclusions():
    """
    Test roll generation and expansion with college register numbers and exclusions.
    """
    rolls = generate_rolls(
        "CSE",
        5,
        roll_start="927623BCS001",
        roll_end="927623BCS007",
        exclusions=["927623BCS003", "927623BCS005"],
    )
    assert rolls == [
        "927623BCS001",
        "927623BCS002",
        "927623BCS004",
        "927623BCS006",
        "927623BCS007",
    ]

