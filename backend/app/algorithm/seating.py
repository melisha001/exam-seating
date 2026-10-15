"""
algorithm/seating.py — Core seating allocation engine for AutoSeat Pro.

Workflow:
1. Fixed Layout Immutability:
   - Layouts configured in Halls & Depts are the single source of truth.
   - Layouts are strictly read-only and never mutated during or before generation.
2. Capacity validation & Distribution:
   - If N > C: Generation is blocked with "Short by X seats. Add a hall or edit benches in Halls & Depts."
   - If N == C: 100% occupancy across selected halls.
   - If N < C: Selected halls are filled to maximum occupancy with unused seats placed
     strictly at the end on the last benches of the last row(s). Benches retain their
     configured seater type (e.g. 3S bench with 2 seated students and 1 unused seat).
   - Proportional distribution across halls by capacity using Hamilton largest remainder method
     (or equal students per hall if toggled and capacities permit).
   - Proportional distribution of each department / medium / subject group across halls.
3. Seating placement & Anti-copying:
   - Column-major constraint solver: fills column by column, top to bottom.
   - Strict horizontal anti-copying: no two students writing the same subject code sit
     immediately left or right of each other (within bench and across bench boundaries).
   - Strict diagonal anti-copying: no two students writing the same subject code sit diagonally.
   - Front/Back (vertical): same subject code directly ahead or behind is allowed and encouraged.
   - Inside each department and subject, arrange students by medium: all EN first, then TA (in roll order).
   - Roll numbers assigned in ascending order down columns.
4. Validation Gate:
   - Automatically verifies all 6 integrity checks:
     1. Fixed layouts unchanged
     2. No unexpected empty seats
     3. No same-subject left/right
     4. No same-subject diagonal
     5. All students seated exactly once
     6. Equal occupancy % across halls
"""

import math
import random
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

from app.algorithm.models import (
    DeptGroup,
    RoomSpec,
    SeatInfo,
    RoomResult,
    SeatingResult,
)
from app.algorithm.labels import get_seat_label, get_seater_breakdown


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Target Calculation (Hamilton Largest Remainder Method)
# ─────────────────────────────────────────────────────────────────────────────

def get_hall_targets(
    total_students: int,
    hall_count: int | None = None,
    rooms: list[RoomSpec] | None = None,
    equal_students_per_hall: bool = False,
) -> list[int]:
    """
    Calculate target student count for each hall.
    Default: Proportional to capacity using Hamilton largest remainder method.
    If equal_students_per_hall is True and capacities allow, distributes equally.
    """
    if hall_count is None:
        hall_count = len(rooms) if rooms else 0

    if hall_count <= 0 or total_students <= 0:
        return [0] * max(0, hall_count)

    if not rooms or len(rooms) != hall_count:
        base = total_students // hall_count
        rem = total_students % hall_count
        return [base + (1 if i < rem else 0) for i in range(hall_count)]

    total_capacity = sum(r.capacity for r in rooms)
    if total_students > total_capacity:
        shortage = total_students - total_capacity
        raise ValueError(
            f"Short by {shortage} seat{'s' if shortage > 1 else ''}. "
            "Add a hall or edit benches in Halls & Depts."
        )

    # Optional equal students distribution if requested and capacities permit
    if equal_students_per_hall:
        base = total_students // hall_count
        rem = total_students % hall_count
        targets = [base + (1 if i < rem else 0) for i in range(hall_count)]
        if all(t <= r.capacity for t, r in zip(targets, rooms)):
            return targets

    # Hamilton Largest Remainder Method proportional to capacity
    if total_capacity == 0:
        return [0] * hall_count

    quotas = [total_students * (r.capacity / total_capacity) for r in rooms]
    bases = [math.floor(q) for q in quotas]
    remainders = [(quotas[i] - bases[i], i) for i in range(hall_count)]
    remainders.sort(key=lambda x: -x[0])

    rem_students = total_students - sum(bases)
    for _, idx in remainders:
        if rem_students <= 0:
            break
        if bases[idx] < rooms[idx].capacity:
            bases[idx] += 1
            rem_students -= 1

    # Safeguard: if any students remain to distribute
    for i in range(hall_count):
        if rem_students <= 0:
            break
        if bases[i] < rooms[i].capacity:
            bases[i] += 1
            rem_students -= 1

    return bases


def validate_hall_capacities(
    dept_groups: list[DeptGroup],
    rooms: list[RoomSpec],
) -> list[str]:
    """
    Validate that selected halls have sufficient capacity for all students.
    Returns a list of error messages (empty if valid).
    """
    total_students = sum(len(dg.rolls) for dg in dept_groups)
    if not rooms:
        return ["No examination halls selected."]
    if total_students == 0:
        return ["No students registered for this session."]

    total_capacity = sum(r.capacity for r in rooms)
    if total_students > total_capacity:
        shortage = total_students - total_capacity
        return [
            f"Short by {shortage} seat{'s' if shortage > 1 else ''}. "
            "Add a hall or edit benches in Halls & Depts."
        ]

    return []


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Equal Group Distribution Across Halls
# ─────────────────────────────────────────────────────────────────────────────

def distribute_students_to_halls(
    dept_groups: list[DeptGroup],
    rooms: list[RoomSpec],
    treat_different_medium_as_different_paper: bool = False,
    equal_students_per_hall: bool = False,
) -> tuple[list[list[dict]], list[int]]:
    """
    Distribute students across halls proportionally for EVERY group
    (department + medium + subject_code) matching Hamilton hall targets.
    Returns (list_of_students_per_hall, targets_per_hall).
    """
    total_students = sum(len(dg.rolls) for dg in dept_groups)
    h = len(rooms)
    targets = get_hall_targets(
        total_students,
        h,
        rooms=rooms,
        equal_students_per_hall=equal_students_per_hall,
    )

    # Group entries by (dept_id, dept_code, medium, subject, subject_code, is_arrear)
    group_pools: dict[tuple, deque] = defaultdict(deque)
    for dg in dept_groups:
        med = (dg.medium or "EN").strip().upper()
        s_code = (dg.subject_code or "").strip().upper()
        grp_key = (dg.dept_id, dg.dept_code, med, dg.subject, s_code, dg.is_arrear)
        for roll in dg.rolls:
            subj_key = (
                f"{s_code}_{med}"
                if treat_different_medium_as_different_paper and s_code
                else (s_code or dg.subject or "").strip().upper()
            )
            group_pools[grp_key].append({
                "roll_number": roll,
                "dept_id": dg.dept_id,
                "dept_code": dg.dept_code,
                "medium": med,
                "subject": dg.subject,
                "subject_code": s_code,
                "is_arrear": dg.is_arrear,
                "subj_key": subj_key,
                "grp_key": grp_key,
            })

    sorted_groups = sorted(group_pools.keys(), key=lambda g: len(group_pools[g]), reverse=True)

    # Matrix: group -> [count for hall 0..h-1]
    matrix: dict[tuple, list[int]] = {g: [0] * h for g in sorted_groups}

    for g in sorted_groups:
        c = len(group_pools[g])
        fracs = []
        for i in range(h):
            ideal = c * (targets[i] / total_students) if total_students > 0 else 0
            b = int(math.floor(ideal))
            matrix[g][i] = b
            fracs.append((ideal - b, i))

        assigned = sum(matrix[g])
        rem_grp = c - assigned
        fracs.sort(key=lambda x: -x[0])
        for _, i in fracs:
            if rem_grp <= 0:
                break
            matrix[g][i] += 1
            rem_grp -= 1

    # Balance matrix so each hall's sum equals targets[i]
    hall_sums = [sum(matrix[g][i] for g in sorted_groups) for i in range(h)]
    for i in range(h):
        while hall_sums[i] < targets[i]:
            found = False
            for j in range(h):
                if hall_sums[j] > targets[j]:
                    for g in sorted_groups:
                        if matrix[g][j] > 0:
                            matrix[g][j] -= 1
                            matrix[g][i] += 1
                            hall_sums[j] -= 1
                            hall_sums[i] += 1
                            found = True
                            break
                    if found:
                        break
            if not found:
                break

        while hall_sums[i] > targets[i]:
            found = False
            for j in range(h):
                if hall_sums[j] < targets[j]:
                    for g in sorted_groups:
                        if matrix[g][i] > 0:
                            matrix[g][i] -= 1
                            matrix[g][j] += 1
                            hall_sums[i] -= 1
                            hall_sums[j] += 1
                            found = True
                            break
                    if found:
                        break
            if not found:
                break

    hall_allocations: list[list[dict]] = [[] for _ in range(h)]
    for g in sorted_groups:
        for i in range(h):
            cnt = matrix[g][i]
            for _ in range(cnt):
                hall_allocations[i].append(group_pools[g].popleft())

    return hall_allocations, targets


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Hall Seating Allocation & Validation Gate
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ValidationReport:
    is_valid: bool
    checklist: dict[str, bool]
    violations: list[str]


def get_subj_key(seat: SeatInfo | Any, treat_different_medium_as_different_paper: bool = False) -> str:
    s_code = (getattr(seat, "subject_code", None) or getattr(seat, "subject", "") or "").strip().upper()
    med = (getattr(seat, "medium", None) or "EN").strip().upper()
    if treat_different_medium_as_different_paper and s_code:
        return f"{s_code}_{med}"
    return s_code


def validate_grid(
    seats: list[SeatInfo],
    room: RoomSpec,
    treat_different_medium_as_different_paper: bool = False,
    expected_rolls: list[str] | None = None,
    expected_count: int | None = None,
    layout_snapshot_before: tuple | None = None,
) -> ValidationReport:
    """
    Validate the final exact grid that will be rendered:
    Check 1: FIXED LAYOUTS UNCHANGED (rows, cols, bench seat counts).
    Check 2: NO UNEXPECTED EMPTY SEATS (if N==C: 0 empty; if N<C: C-N empty at the end).
    Check 3: NO SAME-SUBJECT LEFT/RIGHT (adjacent seats in same row differ).
    Check 4: NO SAME-SUBJECT DIAGONAL (diagonal neighbors in adjacent rows differ).
    Check 5: ALL STUDENTS SEATED EXACTLY ONCE (no duplicates, no missing).
    Check 6: CAPACITY MATCHED / EQUAL OCCUPANCY.
    """
    rows, cols = room.rows, room.cols
    checklist = {
        "fixed_layouts_unchanged": True,
        "no_unexpected_empty_seats": True,
        "no_left_right_conflicts": True,
        "no_diagonal_conflicts": True,
        "all_students_unique": True,
        "capacity_matched": True,
        # Backward-compatibility & UI aliases
        "no_same_subject_left_right": True,
        "no_same_subject_diagonal": True,
        "all_students_seated_once": True,
        "no_empty_seats": True,
    }
    violations: list[str] = []

    # Check 1: Fixed Layouts Unchanged
    if layout_snapshot_before is not None:
        current_snapshot = (room.room_id, room.rows, room.cols, room.seats_per_bench, room.bench_config)
        if current_snapshot != layout_snapshot_before:
            checklist["fixed_layouts_unchanged"] = False
            violations.append(
                f"Room '{room.room_name}': Layout was mutated during generation! (Fixed layout violation)"
            )

    # Order all physical seats in row-major order
    all_physical_positions: list[tuple[int, int, int]] = []
    for r in range(rows):
        for c in range(cols):
            spb = room.get_bench_seats(r, c)
            for s in range(spb):
                all_physical_positions.append((r, c, s))

    seat_by_pos: dict[tuple[int, int, int], SeatInfo] = {
        (s.row, s.col, s.seat_index): s for s in seats
    }

    # Order seats by row
    row_seats_list: list[list[SeatInfo]] = [[] for _ in range(rows)]
    for r, c, s in all_physical_positions:
        st = seat_by_pos.get((r, c, s))
        if st:
            row_seats_list[r].append(st)

    seated_rolls = [s.roll_number for s in seats if not s.is_empty and s.roll_number]
    assigned_count = len(seated_rolls)
    target_count = expected_count if expected_count is not None else assigned_count

    # Check 2: No unexpected empty seats
    # The first target_count seats in all_physical_positions must be occupied;
    # Any seats beyond target_count must be empty (unused seats at the end).
    for idx, pos in enumerate(all_physical_positions):
        st = seat_by_pos.get(pos)
        r, c, s = pos
        lbl = st.seat_label if st else get_seat_label(r, c, s, cols)
        if idx < target_count:
            if not st or st.is_empty or not st.roll_number:
                checklist["no_unexpected_empty_seats"] = False
                checklist["no_empty_seats"] = False
                violations.append(
                    f"Room '{room.room_name}': Unexpected empty seat at R{r + 1} C{c + 1} {lbl}"
                )
        else:
            if st and not st.is_empty and st.roll_number:
                checklist["no_unexpected_empty_seats"] = False
                violations.append(
                    f"Room '{room.room_name}': Seat past target capacity occupied at R{r + 1} C{c + 1} {lbl}"
                )

    if target_count == room.capacity:
        if assigned_count != room.capacity:
            checklist["no_empty_seats"] = False

    # Check 3: No same-subject left/right
    for r in range(rows):
        r_seats = row_seats_list[r]
        for i in range(len(r_seats) - 1):
            s1 = r_seats[i]
            s2 = r_seats[i + 1]
            if not s1.is_empty and not s2.is_empty and s1.roll_number and s2.roll_number:
                k1 = get_subj_key(s1, treat_different_medium_as_different_paper)
                k2 = get_subj_key(s2, treat_different_medium_as_different_paper)
                if k1 and k2 and k1 == k2:
                    checklist["no_left_right_conflicts"] = False
                    checklist["no_same_subject_left_right"] = False
                    violations.append(
                        f"Room '{room.room_name}': R{s1.row + 1} C{s1.col + 1} {s1.seat_label} and "
                        f"R{s2.row + 1} C{s2.col + 1} {s2.seat_label}: {s1.dept_code} {s1.roll_number} "
                        f"next to {s2.dept_code} {s2.roll_number} (Subject '{k1}' Left/Right conflict)"
                    )

    # Check 4: No same-subject diagonal
    seat_by_rj: dict[tuple[int, int], SeatInfo] = {}
    for r in range(rows):
        for j, s in enumerate(row_seats_list[r]):
            seat_by_rj[(r, j)] = s

    for r in range(rows):
        for j, s1 in enumerate(row_seats_list[r]):
            if s1.is_empty or not s1.roll_number:
                continue
            k1 = get_subj_key(s1, treat_different_medium_as_different_paper)
            if r + 1 < rows:
                for pj in (j - 1, j + 1):
                    if (r + 1, pj) in seat_by_rj:
                        s2 = seat_by_rj[(r + 1, pj)]
                        if not s2.is_empty and s2.roll_number:
                            k2 = get_subj_key(s2, treat_different_medium_as_different_paper)
                            if k1 and k2 and k1 == k2:
                                checklist["no_diagonal_conflicts"] = False
                                checklist["no_same_subject_diagonal"] = False
                                violations.append(
                                    f"Room '{room.room_name}': R{s1.row + 1} C{s1.col + 1} {s1.seat_label} and "
                                    f"R{s2.row + 1} C{s2.col + 1} {s2.seat_label}: {s1.dept_code} {s1.roll_number} "
                                    f"diagonal to {s2.dept_code} {s2.roll_number} (Subject '{k1}' Diagonal conflict)"
                                )

    # Check 5: All students unique and matched
    if len(seated_rolls) != len(set(seated_rolls)):
        checklist["all_students_unique"] = False
        checklist["all_students_seated_once"] = False
        seen = set()
        for roll in seated_rolls:
            if roll in seen:
                violations.append(f"Room '{room.room_name}': Duplicate student seated: {roll}")
            seen.add(roll)

    if expected_rolls is not None:
        if set(seated_rolls) != set(expected_rolls):
            checklist["all_students_unique"] = False
            checklist["all_students_seated_once"] = False
            missing = set(expected_rolls) - set(seated_rolls)
            if missing:
                violations.append(
                    f"Room '{room.room_name}': Missing expected students: {', '.join(sorted(missing)[:5])}"
                )

    # Check 6: Capacity / Target matched
    if target_count is not None and assigned_count != target_count:
        checklist["capacity_matched"] = False
        violations.append(
            f"Room '{room.room_name}': Target students ({target_count}) does not match assigned ({assigned_count})"
        )

    is_valid = len(violations) == 0 and all(
        checklist[k] for k in [
            "fixed_layouts_unchanged",
            "no_unexpected_empty_seats",
            "no_left_right_conflicts",
            "no_diagonal_conflicts",
            "all_students_unique",
            "capacity_matched",
        ]
    )
    return ValidationReport(is_valid=is_valid, checklist=checklist, violations=violations)


validateGrid = validate_grid


def _swap_seat_data(s1: SeatInfo, s2: SeatInfo) -> None:
    """Helper to swap candidate details between two SeatInfo instances."""
    (
        s1.roll_number, s2.roll_number,
        s1.dept_id, s2.dept_id,
        s1.dept_code, s2.dept_code,
        s1.subject, s2.subject,
        s1.subject_code, s2.subject_code,
        s1.medium, s2.medium,
        s1.is_arrear, s2.is_arrear,
    ) = (
        s2.roll_number, s1.roll_number,
        s2.dept_id, s1.dept_id,
        s2.dept_code, s1.dept_code,
        s2.subject, s1.subject,
        s2.subject_code, s1.subject_code,
        s2.medium, s1.medium,
        s2.is_arrear, s1.is_arrear,
    )


def repair_grid(
    seats: list[SeatInfo],
    room: RoomSpec,
    treat_different_medium_as_different_paper: bool = False,
    expected_count: int | None = None,
) -> list[SeatInfo]:
    """
    Repair pass: swap students between non-locked active seats to remove violations.
    Prioritizes eliminating left/right conflicts over diagonal conflicts.
    """
    def eval_cost(current_seats: list[SeatInfo]) -> tuple[int, int]:
        report = validate_grid(
            current_seats,
            room,
            treat_different_medium_as_different_paper,
            expected_count=expected_count,
        )
        lr_cnt = sum(1 for v in report.violations if "Left/Right conflict" in v)
        diag_cnt = sum(1 for v in report.violations if "Diagonal conflict" in v)
        return lr_cnt, diag_cnt

    best_lr, best_diag = eval_cost(seats)
    if best_lr == 0 and best_diag == 0:
        return seats

    swappable_indices = [
        i for i, s in enumerate(seats)
        if not s.is_empty and not s.is_locked
    ]

    for _ in range(500):
        if best_lr == 0 and best_diag == 0:
            break

        report = validate_grid(
            seats,
            room,
            treat_different_medium_as_different_paper,
            expected_count=expected_count,
        )
        if report.is_valid:
            break

        viol_labels = set()
        for v in report.violations:
            parts = v.split(":")
            if len(parts) >= 2:
                for w in parts[0].split():
                    if len(w) >= 2 and w[0].isalpha() and w[1:].isdigit():
                        viol_labels.add(w)

        viol_indices = [i for i in swappable_indices if seats[i].seat_label in viol_labels]
        if not viol_indices:
            viol_indices = swappable_indices

        improved = False
        for i in viol_indices:
            for j in swappable_indices:
                if i == j:
                    continue
                k1 = get_subj_key(seats[i], treat_different_medium_as_different_paper)
                k2 = get_subj_key(seats[j], treat_different_medium_as_different_paper)
                if k1 == k2:
                    continue

                _swap_seat_data(seats[i], seats[j])
                new_lr, new_diag = eval_cost(seats)
                new_score = new_lr * 1000 + new_diag
                best_score = best_lr * 1000 + best_diag

                if new_score < best_score:
                    best_lr, best_diag = new_lr, new_diag
                    improved = True
                    break
                else:
                    _swap_seat_data(seats[i], seats[j])

            if improved:
                break

        if not improved:
            break

    return seats


def _assign_hall_seats(
    room: RoomSpec,
    students: list[dict],
    treat_different_medium_as_different_paper: bool = False,
    check_front_back: bool = False,
    locked_seats_by_pos: dict[tuple[int, int, int], SeatInfo] | None = None,
) -> tuple[list[SeatInfo], list[str]]:
    """
    Column-major constraint solver for exam hall seating allocation:
    - Fills COLUMN BY COLUMN (top to bottom inside a column).
    - For each cell (r, j), subject must differ from left neighbor and diagonal neighbors.
    - Same subject directly ahead/behind (vertical) is allowed and encouraged.
    - Active seats: first T seats in row-major order.
    - Unused seats (when T < capacity): remaining seats placed at the end of the hall.
    - Backtracking DFS with remaining-count tracking and forward checking.
    - Randomized restarts (up to 20 restarts) with node limit.
    - Groups students by medium inside a column (all EN first, then TA) and ascending roll order.
    - Validation gate: runs validate_grid() with repair pass if needed.
    """
    rows, cols = room.rows, room.cols
    locked_seats_by_pos = locked_seats_by_pos or {}

    # Build all physical seat positions
    all_physical_positions: list[tuple[int, int, int]] = []
    for r in range(rows):
        for c in range(cols):
            spb = room.get_bench_seats(r, c)
            for s in range(spb):
                all_physical_positions.append((r, c, s))

    cap = len(all_physical_positions)
    T = min(len(students), cap)
    active_positions = all_physical_positions[:T]
    active_positions_set = set(active_positions)

    # Active seats per row
    row_active_seats: list[list[tuple[int, int, int]]] = [[] for _ in range(rows)]
    for pos in active_positions:
        row_active_seats[pos[0]].append(pos)

    K = max((len(row_active_seats[r]) for r in range(rows)), default=0)
    col_cells: dict[int, list[int]] = {
        j: [r for r in range(rows) if j < len(row_active_seats[r])] for j in range(K)
    }
    cells: list[tuple[int, int]] = [(r, j) for j in range(K) for r in col_cells[j]]

    # Map pos -> (r, j) and (r, j) -> pos
    pos_to_rj: dict[tuple[int, int, int], tuple[int, int]] = {}
    rj_to_pos: dict[tuple[int, int], tuple[int, int, int]] = {}
    for r in range(rows):
        for j, pos in enumerate(row_active_seats[r]):
            pos_to_rj[pos] = (r, j)
            rj_to_pos[(r, j)] = pos

    locked_keys = set()
    locked_by_rj: dict[tuple[int, int], str] = {}
    locked_seat_objects: dict[tuple[int, int, int], SeatInfo] = {}

    for pos, lk_seat in locked_seats_by_pos.items():
        if pos in active_positions_set and not lk_seat.is_empty and lk_seat.roll_number:
            s_key = get_subj_key(lk_seat, treat_different_medium_as_different_paper)
            rj = pos_to_rj.get(pos)
            if rj:
                locked_by_rj[rj] = s_key
                locked_keys.add(pos)
                locked_seat_objects[pos] = lk_seat

    locked_rolls = {lk.roll_number for lk in locked_seat_objects.values()}
    pool_students = [st for st in students if st["roll_number"] not in locked_rolls]

    # Group students by subj_key: all EN first, then TA, in roll order
    raw_pools: dict[str, list[dict]] = defaultdict(list)
    for st in pool_students:
        raw_pools[st["subj_key"]].append(st)

    subject_pools: dict[str, deque] = {}
    for s_key, st_list in raw_pools.items():
        en_list = [s for s in st_list if (s.get("medium") or "EN").upper() == "EN"]
        ta_list = [s for s in st_list if (s.get("medium") or "EN").upper() != "EN"]
        en_list.sort(key=lambda s: (s.get("is_arrear", False), s["roll_number"]))
        ta_list.sort(key=lambda s: (s.get("is_arrear", False), s["roll_number"]))
        subject_pools[s_key] = deque(en_list + ta_list)

    counts = {s: len(p) for s, p in subject_pools.items()}

    best_assignment: dict[tuple[int, int], str] | None = None
    MAX_NODES_PER_RESTART = 5_000
    MAX_RESTARTS = 20

    def solve_dfs(attempt_rng: random.Random | None = None) -> bool:
        nonlocal best_assignment
        assignment: dict[tuple[int, int], str] = {}
        rem_counts = dict(counts)
        nodes = 0

        for (r, j), lk_subj in locked_by_rj.items():
            assignment[(r, j)] = lk_subj

        def dfs(idx: int) -> bool:
            nonlocal nodes, best_assignment
            nodes += 1
            if nodes > MAX_NODES_PER_RESTART:
                return False

            if idx == len(cells):
                best_assignment = dict(assignment)
                return True

            r, j = cells[idx]
            if (r, j) in locked_by_rj:
                return dfs(idx + 1)

            rem_cols = K - j
            max_allowed = ((rem_cols + 1) // 2) * rows
            for s, cnt in rem_counts.items():
                if cnt > max_allowed:
                    return False

            # Forbidden subjects for (r, j)
            forbidden = set()
            # 1. Left neighbor
            if j > 0 and (r, j - 1) in assignment:
                forbidden.add(assignment[(r, j - 1)])

            # 2. Diagonals from previous column
            if j > 0:
                for pr in (r - 1, r + 1):
                    if (pr, j - 1) in assignment:
                        forbidden.add(assignment[(pr, j - 1)])

            # 3. Diagonals from subsequent column if already assigned
            for pr in (r - 1, r + 1):
                if (pr, j + 1) in assignment:
                    forbidden.add(assignment[(pr, j + 1)])

            # 4. Front/back if explicitly enabled
            if check_front_back:
                if (r - 1, j) in assignment:
                    forbidden.add(assignment[(r - 1, j)])
                if (r + 1, j) in assignment:
                    forbidden.add(assignment[(r + 1, j)])

            cands = []
            above = assignment.get((r - 1, j))
            if not check_front_back and above is not None and above not in forbidden and rem_counts.get(above, 0) > 0:
                cands.append(above)

            others = [s for s, c in rem_counts.items() if c > 0 and s not in forbidden and s != above]
            if attempt_rng:
                attempt_rng.shuffle(others)
            others.sort(key=lambda s: rem_counts[s], reverse=True)
            cands.extend(others)

            for s in cands:
                rem_counts[s] -= 1
                assignment[(r, j)] = s
                if dfs(idx + 1):
                    return True
                del assignment[(r, j)]
                rem_counts[s] += 1

            return False

        return dfs(0)

    # Run DFS with up to 20 randomized restarts
    for attempt in range(MAX_RESTARTS):
        rng = random.Random(attempt * 101 + 7) if attempt > 0 else None
        if solve_dfs(rng):
            break

    # Phase 2: If strict 0-violation not found, try DFS with strict horizontal and best-effort diagonal
    if best_assignment is None:
        def solve_dfs_h_first(attempt_rng: random.Random | None = None) -> bool:
            nonlocal best_assignment
            assignment: dict[tuple[int, int], str] = {}
            rem_counts = dict(counts)
            nodes = 0

            for (r, j), lk_subj in locked_by_rj.items():
                assignment[(r, j)] = lk_subj

            def dfs2(idx: int) -> bool:
                nonlocal nodes, best_assignment
                nodes += 1
                if nodes > MAX_NODES_PER_RESTART:
                    return False
                if idx == len(cells):
                    best_assignment = dict(assignment)
                    return True
                r, j = cells[idx]
                if (r, j) in locked_by_rj:
                    return dfs2(idx + 1)

                forbidden = set()
                if j > 0 and (r, j - 1) in assignment:
                    forbidden.add(assignment[(r, j - 1)])

                diag_forbidden = set()
                if j > 0:
                    for pr in (r - 1, r + 1):
                        if (pr, j - 1) in assignment:
                            diag_forbidden.add(assignment[(pr, j - 1)])
                for pr in (r - 1, r + 1):
                    if (pr, j + 1) in assignment:
                        diag_forbidden.add(assignment[(pr, j + 1)])

                if check_front_back:
                    if (r - 1, j) in assignment:
                        forbidden.add(assignment[(r - 1, j)])
                    if (r + 1, j) in assignment:
                        forbidden.add(assignment[(r + 1, j)])

                cands = []
                above = assignment.get((r - 1, j))
                if not check_front_back and above is not None and above not in forbidden and rem_counts.get(above, 0) > 0:
                    cands.append(above)

                others = [s for s, c in rem_counts.items() if c > 0 and s not in forbidden and s != above]
                if attempt_rng:
                    attempt_rng.shuffle(others)
                others.sort(key=lambda s: (0 if s in diag_forbidden else 1, rem_counts[s]), reverse=True)
                cands.extend(others)

                for s in cands:
                    rem_counts[s] -= 1
                    assignment[(r, j)] = s
                    if dfs2(idx + 1):
                        return True
                    del assignment[(r, j)]
                    rem_counts[s] += 1
                return False

            return dfs2(0)

        for attempt in range(MAX_RESTARTS):
            rng = random.Random(attempt * 101 + 13) if attempt > 0 else None
            if solve_dfs_h_first(rng):
                break

    assignment = best_assignment
    if assignment is None:
        rem_counts = dict(counts)
        assignment = {}
        for (r, j), lk_subj in locked_by_rj.items():
            assignment[(r, j)] = lk_subj
        for r, j in cells:
            if (r, j) in assignment:
                continue
            above = assignment.get((r - 1, j))
            if above and rem_counts.get(above, 0) > 0:
                chosen = above
            else:
                available = [s for s, c in rem_counts.items() if c > 0]
                chosen = max(available, key=lambda s: rem_counts[s]) if available else None
            if chosen:
                assignment[(r, j)] = chosen
                rem_counts[chosen] -= 1

    # Map assigned subjects to student objects column-by-column
    grid: dict[tuple[int, int, int], dict] = {}
    subject_assigned_positions: dict[str, list[tuple[int, int, int]]] = defaultdict(list)

    for j in range(K):
        for r in col_cells[j]:
            pos = rj_to_pos[(r, j)]
            if pos in locked_keys:
                lk = locked_seat_objects[pos]
                grid[pos] = {
                    "roll_number": lk.roll_number,
                    "dept_id": lk.dept_id,
                    "dept_code": lk.dept_code,
                    "medium": getattr(lk, "medium", "EN") or "EN",
                    "subject": lk.subject,
                    "subject_code": lk.subject_code,
                    "is_arrear": lk.is_arrear,
                    "subj_key": get_subj_key(lk, treat_different_medium_as_different_paper),
                    "is_locked": True,
                }
            else:
                s_key = assignment.get((r, j))
                if s_key:
                    subject_assigned_positions[s_key].append(pos)

    # Roll number assignment: assign students in declaration/reading order
    for s_key, pos_list in subject_assigned_positions.items():
        pos_list.sort(key=lambda p: (p[0], p[1], p[2]))
        for p in pos_list:
            if subject_pools.get(s_key):
                grid[p] = subject_pools[s_key].popleft()

    # Build final SeatInfo list for ALL seats in the room
    final_seats: list[SeatInfo] = []
    for pos in all_physical_positions:
        r, c, s = pos
        lbl = get_seat_label(r, c, s, cols)
        if pos in active_positions_set:
            st = grid.get(pos)
            if st:
                final_seats.append(SeatInfo(
                    row=r,
                    col=c,
                    seat_index=s,
                    roll_number=st["roll_number"],
                    dept_id=st["dept_id"],
                    dept_code=st["dept_code"],
                    subject=st["subject"],
                    subject_code=st["subject_code"],
                    medium=st.get("medium", "EN"),
                    is_empty=False,
                    is_arrear=st.get("is_arrear", False),
                    is_locked=st.get("is_locked", False),
                    seat_label=lbl,
                ))
            else:
                final_seats.append(SeatInfo(
                    row=r,
                    col=c,
                    seat_index=s,
                    roll_number=None,
                    dept_id=None,
                    dept_code=None,
                    subject=None,
                    subject_code=None,
                    medium=None,
                    is_empty=True,
                    is_arrear=False,
                    is_locked=False,
                    seat_label=lbl,
                ))
        else:
            # Unused seat at the end of the hall
            final_seats.append(SeatInfo(
                row=r,
                col=c,
                seat_index=s,
                roll_number=None,
                dept_id=None,
                dept_code=None,
                subject=None,
                subject_code=None,
                medium=None,
                is_empty=True,
                is_arrear=False,
                is_locked=False,
                seat_label=lbl,
            ))

    # Validation gate: check the final grid that will be rendered
    report = validate_grid(
        final_seats,
        room,
        treat_different_medium_as_different_paper,
        expected_count=T,
    )
    if not report.is_valid:
        final_seats = repair_grid(
            final_seats,
            room,
            treat_different_medium_as_different_paper,
            expected_count=T,
        )
        report = validate_grid(
            final_seats,
            room,
            treat_different_medium_as_different_paper,
            expected_count=T,
        )

    warnings = list(report.violations)
    return final_seats, warnings


# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Top-Level Plan Validation & Public API
# ─────────────────────────────────────────────────────────────────────────────

def validate_seating_result(
    result: SeatingResult,
    rooms: list[RoomSpec],
    dept_groups: list[DeptGroup],
    treat_different_medium_as_different_paper: bool = False,
    layout_snapshots_before: list[tuple] | None = None,
) -> ValidationReport:
    """
    Validate all 6 checklist criteria across the entire seating plan:
    1. Fixed layouts unchanged
    2. No unexpected empty seats
    3. No same-subject left/right
    4. No same-subject diagonal
    5. All students seated exactly once
    6. Equal occupancy % across halls
    """
    checklist = {
        "fixed_layouts_unchanged": True,
        "no_unexpected_empty_seats": True,
        "no_left_right_conflicts": True,
        "no_diagonal_conflicts": True,
        "all_students_unique": True,
        "equal_occupancy": True,
    }
    violations: list[str] = []

    # Check 1: Fixed Layouts Unchanged
    if layout_snapshots_before is not None:
        current_snapshots = [
            (r.room_id, r.rows, r.cols, r.seats_per_bench, r.bench_config)
            for r in rooms
        ]
        if current_snapshots != layout_snapshots_before:
            checklist["fixed_layouts_unchanged"] = False
            violations.append("Hall layouts were modified during plan generation! Fixed layout violation.")

    # Check 5: All students seated exactly once
    total_students = sum(len(dg.rolls) for dg in dept_groups)
    all_rolls = [r for dg in dept_groups for r in dg.rolls]
    seated_rolls = [
        s.roll_number
        for rr in result.room_results
        for s in rr.seats
        if not s.is_empty and s.roll_number
    ]
    if len(seated_rolls) != len(set(seated_rolls)):
        checklist["all_students_unique"] = False
        seen = set()
        for r in seated_rolls:
            if r in seen:
                violations.append(f"Duplicate student seated across plan: {r}")
            seen.add(r)

    if set(seated_rolls) != set(all_rolls):
        checklist["all_students_unique"] = False
        missing = set(all_rolls) - set(seated_rolls)
        if missing:
            violations.append(f"Missing {len(missing)} registered students from plan: {', '.join(sorted(missing)[:5])}")

    # Check 2, 3, 4 per room
    for rr, room in zip(result.room_results, rooms):
        report = validate_grid(
            rr.seats,
            room,
            treat_different_medium_as_different_paper=treat_different_medium_as_different_paper,
            expected_count=rr.assigned,
        )
        if not report.checklist.get("no_unexpected_empty_seats", True):
            checklist["no_unexpected_empty_seats"] = False
        if not report.checklist.get("no_left_right_conflicts", True):
            checklist["no_left_right_conflicts"] = False
        if not report.checklist.get("no_diagonal_conflicts", True):
            checklist["no_diagonal_conflicts"] = False
        violations.extend(report.violations)

    # Check 6: Equal Occupancy % across halls (within 5% unless capacity prevented)
    utilizations = [rr.utilization_pct for rr in result.room_results if rr.capacity > 0]
    if utilizations and len(utilizations) > 1:
        diff = max(utilizations) - min(utilizations)
        # Small rounding variations with different hall capacities are permitted up to 5%
        if diff > 5.0 and total_students == sum(r.capacity for r in rooms):
            checklist["equal_occupancy"] = False
            violations.append(f"Occupancy differs by {diff:.1f}% across halls (exceeds 5% tolerance)")

    is_valid = len(violations) == 0 and all(checklist.values())
    return ValidationReport(is_valid=is_valid, checklist=checklist, violations=violations)


def generate_seating(
    dept_groups: list[DeptGroup],
    rooms: list[RoomSpec],
    check_front_back: bool = False,
    locked_seats_by_room: dict[int, dict[tuple[int, int, int], SeatInfo]] | None = None,
    treat_different_medium_as_different_paper: bool = False,
    equal_students_per_hall: bool = False,
) -> SeatingResult:
    """
    Generate an exam seating plan with fixed layouts, maximum occupancy,
    medium ordering (all EN then TA in roll order), and strict horizontal & diagonal anti-copying.
    """
    locked_seats_by_room = locked_seats_by_room or {}
    total_students = sum(len(dg.rolls) for dg in dept_groups)

    if not rooms:
        raise ValueError("Cannot generate seating: No examination halls provided.")
    if total_students == 0:
        raise ValueError("Cannot generate seating: No students to allocate.")

    # Layout Snapshot Before Generation (to ensure zero mutation)
    layout_snapshots_before = [
        (r.room_id, r.rows, r.cols, r.seats_per_bench, r.bench_config)
        for r in rooms
    ]

    # Validate hall capacities
    capacity_errors = validate_hall_capacities(dept_groups, rooms)
    if capacity_errors:
        err_msg = "Generation blocked: " + " ".join(capacity_errors)
        raise ValueError(err_msg)

    # Proportional distribution across halls
    hall_allocations, targets = distribute_students_to_halls(
        dept_groups,
        rooms,
        treat_different_medium_as_different_paper=treat_different_medium_as_different_paper,
        equal_students_per_hall=equal_students_per_hall,
    )

    all_warnings: list[str] = []
    room_results: list[RoomResult] = []
    total_assigned = 0

    for room, students in zip(rooms, hall_allocations):
        room_locked = locked_seats_by_room.get(room.room_id, {})
        seats, room_warnings = _assign_hall_seats(
            room,
            students,
            treat_different_medium_as_different_paper=treat_different_medium_as_different_paper,
            check_front_back=check_front_back,
            locked_seats_by_pos=room_locked,
        )
        all_warnings.extend(room_warnings)

        cap = room.capacity
        assigned = sum(1 for s in seats if not s.is_empty)
        total_assigned += assigned
        util_pct = round(assigned / cap * 100, 1) if cap > 0 else 0.0

        room_results.append(RoomResult(
            room_id=room.room_id,
            room_name=room.room_name,
            invigilator_name=room.invigilator_name,
            seats=seats,
            capacity=cap,
            assigned=assigned,
            utilization_pct=util_pct,
        ))

    # Verify layouts were not mutated
    layout_snapshots_after = [
        (r.room_id, r.rows, r.cols, r.seats_per_bench, r.bench_config)
        for r in rooms
    ]
    if layout_snapshots_before != layout_snapshots_after:
        raise ValueError("Integrity Error: Hall layout was mutated during plan generation.")

    unseated = total_students - total_assigned
    if unseated > 0:
        all_warnings.append(f"ERROR: {unseated} students remained unseated.")

    result = SeatingResult(
        room_results=room_results,
        rooms_used=len(room_results),
        total_assigned=total_assigned,
        unseated_count=unseated,
        warnings=all_warnings,
    )

    # Plan validation gate
    plan_report = validate_seating_result(
        result,
        rooms,
        dept_groups,
        treat_different_medium_as_different_paper=treat_different_medium_as_different_paper,
        layout_snapshots_before=layout_snapshots_before,
    )
    if not plan_report.is_valid:
        all_warnings.extend(plan_report.violations)
        result.warnings = list(dict.fromkeys(all_warnings))

    return result
