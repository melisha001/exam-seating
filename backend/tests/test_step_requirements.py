"""
tests/test_step_requirements.py — Unit tests covering the new workflow:
1. Medium of instruction (EN vs TA) separation and anti-copying
2. 'Treat different medium as a different paper' setting
3. Equal group distribution across halls
4. Overflow redistribution when a hall's maximum capacity is smaller than target
5. Zero empty seats in all rooms
6. End-to-end sample data allocation (ECE, CSE, MECH EN/TA, CIVIL EN/TA)
"""

import pytest
from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.seating import (
    generate_seating,
    get_hall_targets,
    validate_hall_capacities,
    distribute_students_to_halls,
)


def _make_dept_with_medium(
    dept_id: int,
    code: str,
    subject_code: str,
    count: int,
    medium: str = "EN",
) -> DeptGroup:
    rolls = [f"{code}_{medium}_{i:03d}" for i in range(1, count + 1)]
    return DeptGroup(
        dept_id=dept_id,
        dept_code=code,
        subject=subject_code,
        subject_code=subject_code,
        rolls=rolls,
        medium=medium,
    )


# 1. Medium Anti-Copying: MECH EN and MECH TA with same subject code count as same subject
def test_medium_same_subject_anti_copying():
    mech_en = _make_dept_with_medium(1, "MECH", "ME7031", 20, medium="EN")
    mech_ta = _make_dept_with_medium(1, "MECH", "ME7031", 20, medium="TA")
    cse = _make_dept_with_medium(2, "CSE", "CS7031", 40, medium="EN")

    # 80 seats fixed room (8 rows x 5 cols x 2 seats/bench)
    room = RoomSpec(1, "Hall 1", rows=8, cols=5, seats_per_bench=2)

    res = generate_seating([mech_en, mech_ta, cse], [room], treat_different_medium_as_different_paper=False)
    assert res.total_assigned == 80
    assert res.unseated_count == 0

    # Verify no MECH EN is horizontally adjacent to MECH TA (both have ME7031)
    seats = res.room_results[0].seats
    row_map = {}
    for s in seats:
        row_map.setdefault(s.row, []).append(s)

    for r, r_seats in row_map.items():
        r_seats.sort(key=lambda s: (s.col, s.seat_index))
        for i in range(len(r_seats) - 1):
            s1, s2 = r_seats[i], r_seats[i + 1]
            assert s1.subject_code != s2.subject_code, (
                f"Horizontal conflict at row {r}: {s1.seat_label} and {s2.seat_label} share {s1.subject_code}"
            )


# 2. Treat Different Medium as Different Paper toggle
def test_treat_different_medium_as_different_paper():
    mech_en = _make_dept_with_medium(1, "MECH", "ME7031", 20, medium="EN")
    mech_ta = _make_dept_with_medium(1, "MECH", "ME7031", 20, medium="TA")

    # 40 students in 40-seat hall: with toggle True, EN and TA alternate with zero warnings!
    room = RoomSpec(1, "Hall SplitMedium", rows=4, cols=5, seats_per_bench=2)

    res = generate_seating([mech_en, mech_ta], [room], treat_different_medium_as_different_paper=True)
    assert res.total_assigned == 40
    assert res.unseated_count == 0
    assert len(res.warnings) == 0


# 3. Proportional group distribution across halls (difference <= 1)
def test_proportional_group_distribution_across_halls():
    depts = [
        _make_dept_with_medium(1, "MECH", "ME301", 25, medium="EN"),
        _make_dept_with_medium(1, "MECH", "ME301", 15, medium="TA"),
        _make_dept_with_medium(2, "CIVIL", "CE301", 30, medium="EN"),
        _make_dept_with_medium(3, "ECE", "EC301", 30, medium="EN"),
    ]

    # 3 halls with 40 seats each (total 120 capacity > 100 students)
    rooms = [
        RoomSpec(1, "Hall 1", rows=4, cols=5, seats_per_bench=2),
        RoomSpec(2, "Hall 2", rows=4, cols=5, seats_per_bench=2),
        RoomSpec(3, "Hall 3", rows=4, cols=5, seats_per_bench=2),
    ]

    allocations, targets = distribute_students_to_halls(depts, rooms)
    assert [len(a) for a in allocations] == [34, 33, 33]

    # Verify each group's count in each hall differs by at most 1
    for dg in depts:
        counts = [
            sum(1 for st in a if st["dept_id"] == dg.dept_id and st["medium"] == dg.medium)
            for a in allocations
        ]
        assert max(counts) - min(counts) <= 1, (
            f"Group {dg.dept_code} ({dg.medium}) unevenly distributed: {counts}"
        )


# 4. Overflow Redistribution / Proportional Quota
def test_overflow_redistribution_when_room_too_small():
    # Total 60 students, 2 rooms.
    # Room 1 is small: 20 seats (rows=2, cols=5, 2-seater -> 20 seats).
    # Room 2 is large: 50 seats (rows=5, cols=5, 2-seater -> 50 seats).
    # Hamilton quota proportional to capacity:
    # Quotas: 60 * 20/70 = 17.14 -> 17, 60 * 50/70 = 42.86 -> 43.
    room1 = RoomSpec(1, "Small Room", rows=2, cols=5, seats_per_bench=2)
    room2 = RoomSpec(2, "Large Room", rows=5, cols=5, seats_per_bench=2)

    targets = get_hall_targets(60, 2, rooms=[room1, room2])
    assert targets == [17, 43]
    assert all(t <= r.capacity for t, r in zip(targets, [room1, room2]))


# 5. End-to-End Sample Data Run: ECE, CSE, MECH (EN/TA), CIVIL (EN/TA)
def test_sample_data_run():
    depts = [
        _make_dept_with_medium(1, "CSE", "CS501", 20, medium="EN"),
        _make_dept_with_medium(2, "ECE", "EC501", 20, medium="EN"),
        _make_dept_with_medium(3, "MECH", "ME501", 15, medium="EN"),
        _make_dept_with_medium(3, "MECH", "ME501", 15, medium="TA"),
        _make_dept_with_medium(4, "CIVIL", "CE501", 10, medium="EN"),
        _make_dept_with_medium(4, "CIVIL", "CE501", 10, medium="TA"),
    ]

    # Two 45-seat halls (5 rows x 3 cols of 3-seater benches = 45 seats each)
    room1 = RoomSpec(1, "Hall A", rows=5, cols=3, seats_per_bench=3)
    room2 = RoomSpec(2, "Hall B", rows=5, cols=3, seats_per_bench=3)

    res = generate_seating(depts, [room1, room2])
    assert res.total_assigned == 90
    assert res.unseated_count == 0
    assert res.rooms_used == 2
    assert [r.assigned for r in res.room_results] == [45, 45]

    for r_res in res.room_results:
        assert r_res.assigned == r_res.capacity
        assert all(not s.is_empty for s in r_res.seats)

    for r_res in res.room_results:
        for dg in depts:
            dg_seats = [
                s for s in r_res.seats
                if s.dept_id == dg.dept_id and s.medium == dg.medium
            ]
            rolls = [s.roll_number for s in dg_seats]
            assert rolls == sorted(rolls), f"Roll order out of sequence: {rolls}"
