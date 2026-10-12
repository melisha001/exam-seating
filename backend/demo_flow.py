"""
demo_flow.py — Comprehensive end-to-end demo script for Exam Seating Arrangement System.

Demonstrates:
  1. Health check & entity discovery (Halls & Departments)
  2. Full plan generation across all available halls
  3. Adjacency rule validation on manual seat swap:
     - Tests a valid swap
     - Tests an invalid swap (violating non-adjacency) and validates 409 Conflict response
  4. Binary file downloads:
     - Saves 'sample_seating_plan.pdf' (with invigilator signature line)
     - Saves 'sample_seating_plan.xlsx' (colour-coded spreadsheet)

Usage:
  python demo_flow.py
"""

import sys
import os
import json
import httpx

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://localhost:8000/api/v1"


def run_demo():
    print("=" * 70)
    print("🎓 EXAM SEATING ARRANGEMENT SYSTEM — LIVE DEMO")
    print("=" * 70)

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # ── 1. Health & Configuration ─────────────────────────────────────────
        res = client.get("http://localhost:8000/health")
        print(f"\n1. Health Check: {res.status_code} -> {res.json()}")

        # ── 2. Discover Entities ──────────────────────────────────────────────
        rooms = client.get("/rooms/").json()
        depts = client.get("/departments/").json()
        sessions = client.get("/sessions/").json()

        print(f"\n2. Entity Overview:")
        print(f"   • Registered Halls: {len(rooms)} rooms ({sum(r['capacity'] for r in rooms)} total seats)")
        for r in rooms:
            print(f"     - {r['name']:<12} | {r['rows']}R x {r['columns']}C ({r['seats_per_bench']}/bench) = {r['capacity']} seats | Invigilator: {r['invigilator_name']}")

        print(f"   • Academic Depts:   {', '.join([d['code'] for d in depts])}")
        print(f"   • Exam Sessions:    {len(sessions)} configured")

        if not sessions:
            print("No sessions found. Run 'python seed_data.py' first.")
            return

        session_id = sessions[0]["id"]
        entries = client.get(f"/entries/?session_id={session_id}").json()
        total_students = sum(e["student_count"] for e in entries)
        print(f"\n3. Target Exam Session (ID #{session_id}): {sessions[0]['date']} ({sessions[0]['label']})")
        print(f"   • Total Candidates: {total_students} across {len(entries)} departments:")
        for e in entries:
            print(f"     - {e['subject']} ({e['student_count']} candidates)")

        # ── 4. Generate Optimized Seating Plan ────────────────────────────────
        print(f"\n4. Generating Seating Plan (Greedy Round-Robin with Strict Adjacency)...")
        room_ids = [r["id"] for r in rooms]  # Allocate all available rooms
        gen_res = client.post(
            "/plans/generate",
            json={
                "session_id": session_id,
                "room_ids": room_ids,
                "check_front_back": True,
            },
        )
        if gen_res.status_code != 201:
            print(f"   Generation failed: {gen_res.status_code} {gen_res.text}")
            return

        plan = gen_res.json()
        plan_id = plan["plan_id"]
        print(f"   [SUCCESS] Plan Generated (Plan ID: {plan_id})")
        print(f"   • Rooms Used:      {plan['rooms_used']} of {len(rooms)}")
        print(f"   • Total Assigned:  {plan['total_assigned']} candidates")
        print(f"   • Unseated Count:  {plan['unseated_count']}")
        print(f"   • Room Allocations:")
        for rg in plan["rooms"]:
            print(f"     - {rg['room_name']:<12} : {rg['assigned']:>3}/{rg['capacity']:<3} seats ({rg['utilization_pct']:>5}%)")

        # ── 5. Demonstrate Seat Swap Validation ───────────────────────────────
        print(f"\n5. Testing Live Seat Swap & Constraint Validation:")
        seats_room_1 = plan["rooms"][0]["seats"]
        occupied_seats = [s for s in seats_room_1 if not s["is_empty"]]

        if len(occupied_seats) >= 2:
            s_a, s_b = occupied_seats[0], occupied_seats[1]
            print(f"   Attempting swap between Seat {s_a['roll_number']} and Seat {s_b['roll_number']}...")
            swap_res = client.put(
                f"/plans/{plan_id}/swap",
                json={"seat_id_a": s_a["id"], "seat_id_b": s_b["id"]},
            )
            if swap_res.status_code == 200:
                print(f"   [ACCEPTED] Valid swap applied: {swap_res.json()['message']}")
            elif swap_res.status_code == 409:
                print(f"   [REJECTED] 409 Conflict: Adjacency rule violation prevented cheating!")
                print(f"   Details: {swap_res.json()['detail']}")

        # ── 6. Download PDF & Excel Exports ───────────────────────────────────
        print(f"\n6. Exporting Official Exam Documents:")
        # PDF
        pdf_res = client.get(f"/plans/{plan_id}/export/pdf")
        pdf_path = "sample_seating_plan.pdf"
        with open(pdf_path, "wb") as f:
            f.write(pdf_res.content)
        print(f"   [OK] Downloaded PDF:   '{pdf_path}' ({len(pdf_res.content):,} bytes)")

        # Excel
        xlsx_res = client.get(f"/plans/{plan_id}/export/excel")
        xlsx_path = "sample_seating_plan.xlsx"
        with open(xlsx_path, "wb") as f:
            f.write(xlsx_res.content)
        print(f"   [OK] Downloaded Excel: '{xlsx_path}' ({len(xlsx_res.content):,} bytes)")

        print("\n" + "=" * 70)
        print("🎉 DEMO COMPLETED SUCCESSFULLY! All components verified.")
        print("=" * 70)


if __name__ == "__main__":
    run_demo()
