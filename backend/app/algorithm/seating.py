"""
algorithm/seating.py — Core greedy seating algorithm.

═══════════════════════════════════════════════════════════════════════
STRATEGY
═══════════════════════════════════════════════════════════════════════

1. Fill rooms one by one (maximise utilisation per room before opening
   the next room — this minimises the total number of rooms used).

2. Within a room, iterate seats in reading order:
       (row 0, col 0, seat 0) → (row 0, col 0, seat 1) →
       (row 0, col 1, seat 0) → … → (row R-1, col C-1, seat S-1)

3. At each empty seat, collect all departments that still have students
   to seat.  Sort them by remaining student count (descending) — this
   is the ROUND-ROBIN GREEDY heuristic: the largest group is always
   tried first so no department gets "starved" while others fill seats.

4. Walk through the sorted list and pick the FIRST department that
   does NOT violate either hard constraint:
     a) No two students from the SAME department on adjacent seats.
     b) No two students from DIFFERENT departments writing the SAME
        subject on adjacent seats.

5. If NO department can be placed without a violation, the seat is
   marked is_empty=True and a warning is recorded.

6. After all seats in a room are processed, any students still in
   their queues carry forward to the next room.

7. If students remain after all rooms are exhausted, they are reported
   as unseated (unseated_count > 0) with a clear warning.

═══════════════════════════════════════════════════════════════════════
KNOWN LIMITATION / FUTURE WORK
═══════════════════════════════════════════════════════════════════════

The greedy heuristic can leave students unseated even when a valid
arrangement exists (because earlier greedy choices block later seats).
For very constrained inputs (e.g., many depts sharing the same subject,
or only 1–2 depts with 2-seater benches), consider integrating Google
OR-Tools CP-SAT as a fallback:

    from ortools.sat.python import cp_model
    # model the grid coloring problem and call model.Solve()

This module is designed so that `_assign_room_greedy` can be replaced
with an OR-Tools solver without changing any external interface.
"""

from collections import deque

from app.algorithm.adjacency import get_neighbors
from app.algorithm.models import DeptGroup, RoomSpec, SeatInfo, RoomResult, SeatingResult


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_valid_placement(
    grid: dict[tuple[int, int, int], SeatInfo],
    row: int,
    col: int,
    seat_index: int,
    dept_group: DeptGroup,
    room: RoomSpec,
    check_front_back: bool,
) -> bool:
    """
    Return True iff placing a student from `dept_group` at (row, col, seat_index)
    does not violate either hard adjacency constraint.
    """
    neighbors = get_neighbors(
        row, col, seat_index,
        room.rows, room.cols, room.seats_per_bench,
        check_front_back,
    )
    for pos in neighbors:
        neighbor = grid.get(pos)
        if neighbor is None or neighbor.is_empty:
            continue
        # Hard constraint 1: same department adjacent
        if neighbor.dept_id == dept_group.dept_id:
            return False
        # Hard constraint 2: different depts but same subject adjacent
        if neighbor.subject == dept_group.subject:
            return False
    return True


def _assign_room_greedy(
    room: RoomSpec,
    dept_groups: list[DeptGroup],
    queues: list[deque],          # mutated in place — pops assigned rolls
    check_front_back: bool,
) -> tuple[list[SeatInfo], list[str]]:
    """
    Greedy seat assignment for a single room.

    Returns
    -------
    seats    : list of SeatInfo for every physical seat (assigned or empty)
    warnings : human-readable constraint/capacity messages for this room
    """
    rows, cols, spb = room.rows, room.cols, room.seats_per_bench
    grid: dict[tuple[int, int, int], SeatInfo] = {}
    warnings: list[str] = []
    constraint_blocked = 0   # seats left empty due to hard constraints

    all_positions = [
        (r, c, s)
        for r in range(rows)
        for c in range(cols)
        for s in range(spb)
    ]

    for r, c, s in all_positions:
        # Departments that still have students to seat (largest queue first)
        active = sorted(
            [(i, len(queues[i])) for i in range(len(dept_groups)) if queues[i]],
            key=lambda x: -x[1],
        )

        if not active:
            # No more students — remaining seats are physically empty
            grid[(r, c, s)] = SeatInfo(r, c, s, None, None, None, None, is_empty=True)
            continue

        placed = False
        for dept_idx, _ in active:
            dg = dept_groups[dept_idx]
            if _is_valid_placement(grid, r, c, s, dg, room, check_front_back):
                roll = queues[dept_idx].popleft()
                grid[(r, c, s)] = SeatInfo(
                    row=r, col=c, seat_index=s,
                    roll_number=roll,
                    dept_id=dg.dept_id,
                    dept_code=dg.dept_code,
                    subject=dg.subject,
                    is_empty=False,
                )
                placed = True
                break

        if not placed:
            constraint_blocked += 1
            grid[(r, c, s)] = SeatInfo(r, c, s, None, None, None, None, is_empty=True)

    if constraint_blocked > 0:
        still_waiting = sum(len(q) for q in queues)
        warnings.append(
            f"Room '{room.room_name}': {constraint_blocked} seat(s) could not be filled "
            f"without violating an adjacency constraint and were left empty. "
            f"{still_waiting} student(s) are still waiting after this room."
        )

    return list(grid.values()), warnings


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_seating(
    dept_groups: list[DeptGroup],
    rooms: list[RoomSpec],
    check_front_back: bool = True,
) -> SeatingResult:
    """
    Generate a complete seating plan for an exam session.

    Parameters
    ----------
    dept_groups      : One entry per department participating in this session.
                       Each entry carries the ordered roll-number list.
    rooms            : Rooms to use, in order.  They are filled one by one;
                       a later room is opened only when the previous is full
                       (or all its seats are constraint-blocked).
    check_front_back : When True, the bench directly in front and behind is
                       also treated as adjacent (stricter constraint).

    Returns
    -------
    SeatingResult with per-room grids, utilisation stats, unseated count,
    and a list of human-readable warnings.
    """
    all_warnings: list[str] = []

    # ── Pre-flight warnings ───────────────────────────────────────────────────

    total_students = sum(len(dg.rolls) for dg in dept_groups)
    total_capacity = sum(r.rows * r.cols * r.seats_per_bench for r in rooms)

    if total_students > total_capacity:
        all_warnings.append(
            f"WARNING: {total_students} students but only {total_capacity} seats across "
            f"{len(rooms)} room(s). At least "
            f"{total_students - total_capacity} student(s) cannot be seated."
        )

    active_depts = [dg for dg in dept_groups if dg.rolls]

    if len(active_depts) == 1:
        all_warnings.append(
            f"WARNING: Only one department ('{active_depts[0].dept_code}') is being seated. "
            f"Because same-department students cannot be adjacent, every other seat "
            f"in each bench/column will be left empty, reducing effective utilisation."
        )

    # Detect departments sharing the same subject (cross-dept adjacency constraint kicks in)
    subject_dept_map: dict[str, list[str]] = {}
    for dg in dept_groups:
        subject_dept_map.setdefault(dg.subject, []).append(dg.dept_code)
    for subj, codes in subject_dept_map.items():
        if len(codes) > 1:
            all_warnings.append(
                f"INFO: Departments {codes} all write '{subj}'. "
                f"Their students will be treated as mutually non-adjacent "
                f"(hard constraint 2), which may reduce room utilisation."
            )

    # ── Build per-department roll queues ──────────────────────────────────────
    queues: list[deque] = [deque(dg.rolls) for dg in dept_groups]

    # ── Room-by-room assignment ───────────────────────────────────────────────
    room_results: list[RoomResult] = []
    rooms_used = 0

    for room in rooms:
        if all(not q for q in queues):
            break   # All students have been seated — don't open more rooms

        room_seats, room_warnings = _assign_room_greedy(
            room, dept_groups, queues, check_front_back
        )
        all_warnings.extend(room_warnings)
        rooms_used += 1

        capacity = room.rows * room.cols * room.seats_per_bench
        assigned = sum(1 for seat in room_seats if not seat.is_empty)
        utilisation = round(assigned / capacity * 100, 1) if capacity > 0 else 0.0

        room_results.append(RoomResult(
            room_id=room.room_id,
            room_name=room.room_name,
            invigilator_name=room.invigilator_name,
            seats=room_seats,
            capacity=capacity,
            assigned=assigned,
            utilization_pct=utilisation,
        ))

    # ── Post-flight: unseated students ────────────────────────────────────────
    unseated = sum(len(q) for q in queues)
    if unseated > 0:
        dept_summary = ", ".join(
            f"{dept_groups[i].dept_code}×{len(queues[i])}"
            for i in range(len(dept_groups))
            if queues[i]
        )
        all_warnings.append(
            f"ERROR: {unseated} student(s) could NOT be seated "
            f"({dept_summary}). "
            f"Either add more rooms or relax adjacency constraints."
        )

    return SeatingResult(
        room_results=room_results,
        rooms_used=rooms_used,
        total_assigned=total_students - unseated,
        unseated_count=unseated,
        warnings=all_warnings,
    )
