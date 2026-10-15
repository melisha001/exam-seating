"""
demo_fixed_layouts_and_one_seater.py
Demonstration script for AutoSeat Pro's:
1. 1-Seater bench support & seater breakdown string
2. Fixed hall layouts with zero mutation
3. Hamilton proportional student distribution & partial occupancy with trailing unused seats
4. Text seating grid visualization (subjects, medium EN/TA, rolls)
5. 6-Point Validation Gate report
"""

import hashlib
import json
from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.seating import generate_seating, validate_seating_result
from app.algorithm.labels import get_seater_breakdown

def compute_layout_hash(room: RoomSpec) -> str:
    raw = f"{room.room_id}:{room.rows}x{room.cols}:{room.seats_per_bench}:{room.bench_config}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]

def run_demo():
    print("=" * 80)
    print("           AUTOSEAT PRO - ALLOCATION & VALIDATION DEMONSTRATION")
    print("=" * 80)

    # 1. Setup Rooms:
    # Room 1: Mixed 1S, 2S, 3S benches (Total 14 seats)
    # Row 0: 1S (1), 2S (2), 3S (3) -> 6 seats
    # Row 1: 2S (2), 3S (3), 3S (3) -> 8 seats
    cfg1 = {
        "0-0": 1, "0-1": 2, "0-2": 3,
        "1-0": 2, "1-1": 3, "1-2": 3,
    }
    room1 = RoomSpec(
        room_id=101,
        room_name="Hall Alpha (Mixed 1S/2S/3S)",
        rows=2,
        cols=3,
        seats_per_bench=2,
        bench_config=json.dumps(cfg1),
    )

    # Room 2: Pure 1-seater desks (Total 8 seats)
    cfg2 = {f"{r}-{c}": 1 for r in range(2) for c in range(4)}
    room2 = RoomSpec(
        room_id=102,
        room_name="Hall Beta (All 1-Seater Desks)",
        rows=2,
        cols=4,
        seats_per_bench=1,
        bench_config=json.dumps(cfg2),
    )

    rooms = [room1, room2]
    total_cap = sum(r.capacity for r in rooms)

    print("\n[STEP 1] CONFIGURED HALLS & SEATER BREAKDOWNS:")
    for r in rooms:
        print(f"  • {r.room_name}")
        print(f"    - Dimensions : {r.rows} rows × {r.cols} bench columns")
        print(f"    - Capacity   : {r.capacity} seats")
        print(f"    - Breakdown  : {r.seater_breakdown}")
        print(f"    - Layout Hash: {compute_layout_hash(r)}")

    # Record pre-allocation snapshots and hashes
    pre_hashes = {r.room_id: compute_layout_hash(r) for r in rooms}
    snapshots_before = [(r.room_id, r.rows, r.cols, r.seats_per_bench, r.bench_config) for r in rooms]

    # 2. Students & Departments
    # MECH has both EN (English) and TA (Tamil) medium with subject ME301
    # ECE has EN medium with subject EC301
    # CSE has EN medium with subject CS301
    # Total students = 18 (out of 22 total capacity -> 4 unused seats at end)
    groups = [
        DeptGroup(dept_id=1, dept_code="ECE", subject="Signals", subject_code="EC301", medium="EN", rolls=[f"ECE{i:02d}" for i in range(1, 7)]),
        DeptGroup(dept_id=2, dept_code="MECH", subject="Thermo", subject_code="ME301", medium="EN", rolls=[f"MEC-EN{i:02d}" for i in range(1, 4)]),
        DeptGroup(dept_id=2, dept_code="MECH", subject="Thermo", subject_code="ME301", medium="TA", rolls=[f"MEC-TA{i:02d}" for i in range(1, 4)]),
        DeptGroup(dept_id=3, dept_code="CSE", subject="Algos", subject_code="CS301", medium="EN", rolls=[f"CSE{i:02d}" for i in range(1, 7)]),
    ]
    total_students = sum(len(g.rolls) for g in groups)
    print(f"\n[STEP 2] REGISTERED STUDENTS: {total_students} students across 3 departments & 2 mediums")
    for g in groups:
        print(f"  • {g.dept_code} ({g.medium}): {len(g.rolls)} students | Subj: {g.subject_code}")
    print(f"  • Overall Capacity: {total_cap} seats | Expected Unused: {total_cap - total_students} seats at trailing positions")

    # 3. Plan Generation
    print("\n[STEP 3] RUNNING COLUMN-MAJOR CONSTRAINT SOLVER...")
    result = generate_seating(
        groups,
        rooms,
        check_front_back=False, # front/back allowed & encouraged
        treat_different_medium_as_different_paper=False, # MECH EN & TA count as same paper
    )

    # 4. Immutability Verification
    print("\n[STEP 4] LAYOUT IMMUTABILITY VERIFICATION (ZERO MUTATION):")
    for r in rooms:
        post_hash = compute_layout_hash(r)
        status = "PASSED (MATCH)" if post_hash == pre_hashes[r.room_id] else "FAILED"
        print(f"  • {r.room_name}: Pre={pre_hashes[r.room_id]} | Post={post_hash} -> {status}")

    # 5. Seating Grid Display
    print("\n[STEP 5] GENERATED SEATING GRIDS:")
    for room_res in result.room_results:
        print("-" * 75)
        print(f"Room: {room_res.room_name} | Seated: {room_res.assigned}/{room_res.capacity} ({room_res.utilization_pct}%)")
        print("-" * 75)
        
        # Group seats by row
        seats_by_row = {}
        for s in room_res.seats:
            seats_by_row.setdefault(s.row, []).append(s)
            
        for r_idx in sorted(seats_by_row.keys()):
            r_seats = seats_by_row[r_idx]
            bench_strs = []
            # Group by col
            by_col = {}
            for s in r_seats:
                by_col.setdefault(s.col, []).append(s)
            for c_idx in sorted(by_col.keys()):
                col_seats = by_col[c_idx]
                col_s_strs = []
                for s in col_seats:
                    if s.is_empty:
                        col_s_strs.append(f"[{s.seat_label}: --Unused--]")
                    else:
                        med_tag = f" {s.medium}" if s.medium != "EN" else ""
                        col_s_strs.append(f"[{s.seat_label}: {s.dept_code}{med_tag} {s.roll_number}]")
                bench_type = f"{len(col_seats)}S"
                bench_strs.append(f"Bench C{c_idx+1}({bench_type}): " + " ".join(col_s_strs))
            print(f" Row {r_idx+1} | " + " | ".join(bench_strs))

    # 6. Validation Gate
    print("\n[STEP 6] 6-POINT VALIDATION GATE CHECKLIST:")
    report = validate_seating_result(
        result,
        rooms,
        groups,
        layout_snapshots_before=snapshots_before,
    )
    for check_name, passed in report.checklist.items():
        symbol = "[PASS] [OK]" if passed else "[FAIL] [X]"
        print(f"  {symbol} {check_name}")

    if report.violations:
        print("\nVIOLATIONS FOUND:")
        for v in report.violations:
            print(f"  - {v}")
    else:
        print("\n=> ALL 6 INTEGRITY CHECKS PASSED WITH 0 VIOLATIONS. Plan is 100% compliant!")
    print("=" * 80)

if __name__ == "__main__":
    run_demo()
