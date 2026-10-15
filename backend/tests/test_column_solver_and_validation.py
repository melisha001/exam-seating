"""
backend/tests/test_column_solver_and_validation.py

Test Suite for Column-Major Constraint Solver & Validation Gate:
1. Regression case from screenshot: 2 rows, 13 seat columns (last column 1 seat, 25 seats), ECE 9, MECH 7, CSE 9.
   Expect zero left/right and zero diagonal same-subject pairs and zero empty seats.
2. Same case with the hall edited to a different 1/2/3-seater mix that still gives the same capacity (25 seats).
3. 3 subjects with equal counts, 3 subjects with uneven counts, only 2 subjects, a dominant subject (warning expected),
   and capacity smaller than the number of seat columns.
4. 1-seater benches in the middle of a hall, checking conflicts across the 1-seater bench boundary.
5. MECH-EN and MECH-TA with the same subject code seated next to each other, which must be reported as a violation
   and avoided by the solver.
6. Property test: for 200 random hall layouts and random subject counts that sum exactly to capacity, the solver
   output either has zero violations or returns a warning, and the grid passes validateGrid() whenever there is no warning.
"""

import random
import pytest

from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.seating import generate_seating, validate_grid, validateGrid
from app.algorithm.roll_numbers import generate_rolls


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Regression case from the screenshot
# 2 rows, 13 seat columns where the last column has only 1 seat (25 seats),
# ECE 9, MECH 7, CSE 9.
# Expect zero left/right, zero diagonal same-subject pairs, and zero empty seats.
# ─────────────────────────────────────────────────────────────────────────────

def test_regression_screenshot_2rows_13cols_25seats():
    cfg = {
        "0-0": 3, "0-1": 3, "0-2": 3, "0-3": 2, "0-4": 2,  # Row 0: 13 seats (seat cols 0..12)
        "1-0": 3, "1-1": 3, "1-2": 3, "1-3": 2, "1-4": 1,  # Row 1: 12 seats (seat cols 0..11)
    }
    room = RoomSpec(room_id=1, room_name="ScreenshotHall", rows=2, cols=5, seats_per_bench=2, bench_config=cfg)

    depts = [
        DeptGroup(dept_id=1, dept_code="ECE", subject="ECE", rolls=generate_rolls("ECE", 9), subject_code="ECE"),
        DeptGroup(dept_id=2, dept_code="MECH", subject="MECH", rolls=generate_rolls("MECH", 7), subject_code="MECH"),
        DeptGroup(dept_id=3, dept_code="CSE", subject="CSE", rolls=generate_rolls("CSE", 9), subject_code="CSE"),
    ]

    res = generate_seating(depts, [room])

    # Basic invariants
    assert res.total_assigned == 25, f"Expected 25 seats assigned, got {res.total_assigned}"
    assert res.unseated_count == 0, f"Expected 0 unseated, got {res.unseated_count}"

    # Validation gate check
    seats = res.room_results[0].seats
    report = validate_grid(seats, room)

    assert report.is_valid, f"Expected grid to be 100% valid, but got violations: {report.violations}"
    assert report.checklist["no_empty_seats"] is True
    assert report.checklist["no_left_right_conflicts"] is True
    assert report.checklist["no_diagonal_conflicts"] is True
    assert report.checklist["all_students_unique"] is True
    assert report.checklist["capacity_matched"] is True
    assert len(res.warnings) == 0, f"Expected zero warnings, got: {res.warnings}"

    # Verify no two horizontally adjacent seats have the same subject
    row_map: dict[int, list] = {}
    for s in seats:
        row_map.setdefault(s.row, []).append(s)

    for r, r_seats in row_map.items():
        r_seats.sort(key=lambda s: (s.col, s.seat_index))
        for i in range(len(r_seats) - 1):
            assert r_seats[i].subject_code != r_seats[i + 1].subject_code, (
                f"Row {r} conflict between {r_seats[i].seat_label} and {r_seats[i + 1].seat_label}"
            )


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Same case with the hall edited to a different 1/2/3-seater mix
# (e.g. 3+2+3+1+2 in Row 0 and adjusted Row 1 to still give 25 seats).
# ─────────────────────────────────────────────────────────────────────────────

def test_regression_edited_seater_mix_same_capacity():
    # Row 0: 3+2+3+1+2 = 11 seats (5 benches)
    # Row 1: 3+3+3+2+3 = 14 seats (5 benches)
    # Total = 11 + 14 = 25 seats
    cfg = {
        "0-0": 3, "0-1": 2, "0-2": 3, "0-3": 1, "0-4": 2,
        "1-0": 3, "1-1": 3, "1-2": 3, "1-3": 2, "1-4": 3,
    }
    room = RoomSpec(room_id=2, room_name="EditedMixHall", rows=2, cols=5, seats_per_bench=2, bench_config=cfg)

    depts = [
        DeptGroup(dept_id=1, dept_code="ECE", subject="ECE", rolls=generate_rolls("ECE", 9), subject_code="ECE"),
        DeptGroup(dept_id=2, dept_code="MECH", subject="MECH", rolls=generate_rolls("MECH", 7), subject_code="MECH"),
        DeptGroup(dept_id=3, dept_code="CSE", subject="CSE", rolls=generate_rolls("CSE", 9), subject_code="CSE"),
    ]

    res = generate_seating(depts, [room])
    assert res.total_assigned == 25
    assert res.unseated_count == 0

    seats = res.room_results[0].seats
    report = validate_grid(seats, room)

    assert report.is_valid, f"Edited layout violations: {report.violations}"
    assert report.checklist["no_empty_seats"] is True
    assert report.checklist["no_left_right_conflicts"] is True
    assert report.checklist["no_diagonal_conflicts"] is True
    assert len(res.warnings) == 0


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Various subject count scenarios:
# 3 subjects equal, 3 subjects uneven, only 2 subjects, dominant subject (warning expected),
# and capacity smaller than the number of seat columns.
# ─────────────────────────────────────────────────────────────────────────────

def test_various_subject_count_scenarios():
    # 3a. 3 subjects with equal counts (8, 8, 8 in 24 seats)
    room_equal = RoomSpec(room_id=3, room_name="EqualHall", rows=2, cols=6, seats_per_bench=2)  # 24 seats
    depts_equal = [
        DeptGroup(1, "A", "SUBJ_A", generate_rolls("A", 8), "SUBJ_A"),
        DeptGroup(2, "B", "SUBJ_B", generate_rolls("B", 8), "SUBJ_B"),
        DeptGroup(3, "C", "SUBJ_C", generate_rolls("C", 8), "SUBJ_C"),
    ]
    res_equal = generate_seating(depts_equal, [room_equal])
    assert res_equal.total_assigned == 24
    assert len(res_equal.warnings) == 0
    assert validate_grid(res_equal.room_results[0].seats, room_equal).is_valid is True

    # 3b. 3 subjects with uneven counts (10, 8, 6 in 24 seats)
    depts_uneven = [
        DeptGroup(1, "A", "SUBJ_A", generate_rolls("A", 10), "SUBJ_A"),
        DeptGroup(2, "B", "SUBJ_B", generate_rolls("B", 8), "SUBJ_B"),
        DeptGroup(3, "C", "SUBJ_C", generate_rolls("C", 6), "SUBJ_C"),
    ]
    res_uneven = generate_seating(depts_uneven, [room_equal])
    assert res_uneven.total_assigned == 24
    assert len(res_uneven.warnings) == 0
    assert validate_grid(res_uneven.room_results[0].seats, room_equal).is_valid is True

    # 3c. Only 2 subjects (10, 10 in 20 seats with uniform 2-seater columns)
    room_two = RoomSpec(room_id=4, room_name="TwoSubjHall", rows=2, cols=5, seats_per_bench=2)  # 20 seats
    depts_two = [
        DeptGroup(1, "A", "SUBJ_A", generate_rolls("A", 10), "SUBJ_A"),
        DeptGroup(2, "B", "SUBJ_B", generate_rolls("B", 10), "SUBJ_B"),
    ]
    res_two = generate_seating(depts_two, [room_two])
    assert res_two.total_assigned == 20
    assert len(res_two.warnings) == 0
    assert validate_grid(res_two.room_results[0].seats, room_two).is_valid is True

    # 3d. Dominant subject: 16 out of 25 seats (warning expected)
    cfg_dom = {
        "0-0": 3, "0-1": 3, "0-2": 3, "0-3": 2, "0-4": 2,
        "1-0": 3, "1-1": 3, "1-2": 3, "1-3": 2, "1-4": 1,
    }
    room_dom = RoomSpec(room_id=5, room_name="DomHall", rows=2, cols=5, seats_per_bench=2, bench_config=cfg_dom)
    depts_dom = [
        DeptGroup(1, "DOM", "SUBJ_DOM", generate_rolls("DOM", 16), "SUBJ_DOM"),
        DeptGroup(2, "MIN1", "SUBJ_M1", generate_rolls("M1", 5), "SUBJ_M1"),
        DeptGroup(3, "MIN2", "SUBJ_M2", generate_rolls("M2", 4), "SUBJ_M2"),
    ]
    res_dom = generate_seating(depts_dom, [room_dom])
    assert res_dom.total_assigned == 25
    assert len(res_dom.warnings) > 0, "Dominant subject must emit warnings"
    assert any("Left/Right conflict" in w or "Conflict" in w or "conflict" in w for w in res_dom.warnings)

    # 3e. Capacity smaller than number of seat columns
    # e.g. 1 row of benches where some seats are trimmed, e.g. 5 columns of 1-seaters with 2 subjects
    room_small = RoomSpec(room_id=6, room_name="SmallHall", rows=1, cols=5, seats_per_bench=1)
    depts_small = [
        DeptGroup(1, "A", "SUBJ_A", generate_rolls("A", 3), "SUBJ_A"),
        DeptGroup(2, "B", "SUBJ_B", generate_rolls("B", 2), "SUBJ_B"),
    ]
    res_small = generate_seating(depts_small, [room_small])
    assert res_small.total_assigned == 5
    assert len(res_small.warnings) == 0
    assert validate_grid(res_small.room_results[0].seats, room_small).is_valid is True


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: 1-seater benches in the middle of a hall, checking conflicts across
# the 1-seater bench boundary.
# ─────────────────────────────────────────────────────────────────────────────

def test_one_seater_benches_in_middle_of_hall():
    # 3 bench columns: Bench 0 is 2S, Bench 1 is 1S (middle), Bench 2 is 2S.
    # Total per row = 2 + 1 + 2 = 5 seats.
    # 2 rows = 10 seats total.
    cfg = {
        "0-0": 2, "0-1": 1, "0-2": 2,
        "1-0": 2, "1-1": 1, "1-2": 2,
    }
    room = RoomSpec(room_id=7, room_name="MiddleOneSeaterHall", rows=2, cols=3, seats_per_bench=2, bench_config=cfg)

    # 3 subjects: A (4), B (3), C (3) = 10 students
    depts = [
        DeptGroup(1, "A", "SUBJ_A", generate_rolls("A", 4), "SUBJ_A"),
        DeptGroup(2, "B", "SUBJ_B", generate_rolls("B", 3), "SUBJ_B"),
        DeptGroup(3, "C", "SUBJ_C", generate_rolls("C", 3), "SUBJ_C"),
    ]

    res = generate_seating(depts, [room])
    assert res.total_assigned == 10
    assert len(res.warnings) == 0

    seats = res.room_results[0].seats
    report = validate_grid(seats, room)
    assert report.is_valid is True

    # Specifically check the 1-seater bench boundary in both rows
    row_map: dict[int, list] = {}
    for s in seats:
        row_map.setdefault(s.row, []).append(s)

    for r in range(2):
        r_seats = sorted(row_map[r], key=lambda s: (s.col, s.seat_index))
        # Bench 0 seat 1 (col 0, seat_index 1) and Bench 1 seat 0 (col 1, seat_index 0)
        s_left_of_1s = r_seats[1]
        s_1s = r_seats[2]
        s_right_of_1s = r_seats[3]

        assert s_left_of_1s.subject_code != s_1s.subject_code, (
            f"Conflict across 1-seater left boundary at row {r}"
        )
        assert s_1s.subject_code != s_right_of_1s.subject_code, (
            f"Conflict across 1-seater right boundary at row {r}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: MECH-EN and MECH-TA with the same subject code seated next to each
# other must be reported as a violation and avoided by the solver.
# ─────────────────────────────────────────────────────────────────────────────

def test_mech_en_ta_same_subject_code_violation_and_avoidance():
    # When seated together with a third department, solver must avoid placing
    # MECH-EN and MECH-TA (with same subject code) horizontally adjacent.
    mech_en = DeptGroup(1, "MECH", "ME7031", generate_rolls("ME_EN", 4), "ME7031", medium="EN")
    mech_ta = DeptGroup(1, "MECH", "ME7031", generate_rolls("ME_TA", 4), "ME7031", medium="TA")
    cse = DeptGroup(2, "CSE", "CS7031", generate_rolls("CSE", 8), "CS7031", medium="EN")

    # 16 seats: 2 rows x 4 cols x 2 seats (MECH total 8, CSE 8)
    room = RoomSpec(room_id=8, room_name="MediumHall", rows=2, cols=4, seats_per_bench=2)

    res = generate_seating([mech_en, mech_ta, cse], [room], treat_different_medium_as_different_paper=False)
    assert res.total_assigned == 16
    assert len(res.warnings) == 0

    seats = res.room_results[0].seats
    report = validate_grid(seats, room, treat_different_medium_as_different_paper=False)
    assert report.is_valid is True

    # Also verify validate_grid directly detects when EN and TA with same subject code are adjacent
    # by artificially creating two adjacent seats with MECH-EN and MECH-TA
    from app.algorithm.models import SeatInfo
    dummy_seats = [
        SeatInfo(row=0, col=0, seat_index=0, roll_number="ME_EN_001", dept_id=1, dept_code="MECH",
                 subject="ME7031", subject_code="ME7031", medium="EN", seat_label="A1"),
        SeatInfo(row=0, col=0, seat_index=1, roll_number="ME_TA_001", dept_id=1, dept_code="MECH",
                 subject="ME7031", subject_code="ME7031", medium="TA", seat_label="B1"),
    ]
    dummy_room = RoomSpec(room_id=99, room_name="Dummy", rows=1, cols=1, seats_per_bench=2)
    dummy_report = validate_grid(dummy_seats, dummy_room, treat_different_medium_as_different_paper=False)
    assert dummy_report.is_valid is False
    assert any("Left/Right conflict" in v for v in dummy_report.violations)


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Property test for 200 random hall layouts and random subject counts
# ─────────────────────────────────────────────────────────────────────────────

def test_property_200_random_hall_layouts():
    """
    Property test: for 200 random hall layouts and random subject counts that sum exactly
    to capacity, the solver output either has zero violations or returns a warning, and
    the grid passes validateGrid() whenever there is no warning.
    """
    for seed in range(200):
        rng = random.Random(seed + 1000)
        rows = rng.randint(2, 4)
        cols = rng.randint(2, 5)

        bench_config = {}
        for r in range(rows):
            for c in range(cols):
                bench_config[f"{r}-{c}"] = rng.randint(1, 3)

        capacity = sum(bench_config.values())
        if capacity < 4:
            continue

        num_subjects = rng.randint(2, 4)
        # Partition capacity among num_subjects
        counts = [1] * num_subjects
        remaining = capacity - num_subjects
        for _ in range(remaining):
            counts[rng.randint(0, num_subjects - 1)] += 1

        depts = []
        for i, cnt in enumerate(counts):
            code = f"D{i+1}"
            subj = f"SUBJ_{i+1}"
            rolls = [f"{code}_{k:03d}" for k in range(1, cnt + 1)]
            depts.append(DeptGroup(dept_id=i+1, dept_code=code, subject=subj, rolls=rolls, subject_code=subj))

        room = RoomSpec(room_id=100 + seed, room_name=f"RandomHall_{seed}", rows=rows, cols=cols,
                        seats_per_bench=2, bench_config=bench_config)

        res = generate_seating(depts, [room])
        assert res.total_assigned == capacity
        assert res.unseated_count == 0

        seats = res.room_results[0].seats
        report = validate_grid(seats, room)

        # Invariant 1: capacity matched and no empty seats
        assert report.checklist["no_empty_seats"] is True
        assert report.checklist["capacity_matched"] is True
        assert report.checklist["all_students_unique"] is True

        # Invariant 2: whenever there are zero warnings, the grid MUST pass validateGrid() completely
        if len(res.warnings) == 0:
            assert report.is_valid is True, f"Seed {seed}: warnings empty but validate_grid failed: {report.violations}"
        else:
            # If there are violations, warnings must not be empty! Never silently output violations
            assert len(report.violations) > 0
            assert len(res.warnings) > 0
