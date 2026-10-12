"""
seed_data.py — Database seeding script for Exam Seating Arrangement System.

Populates the database with:
  • 4 Academic Departments (CSE, ECE, MECH, CIVIL)
  • 6 Examination Halls with diverse layouts and capacities (Total: 412 seats)
  • 1 Scheduled Exam Session (Morning / FN)
  • 4 Department Exam Entries with student counts and roll number ranges
  • Automatically computes and generates the initial Seating Plan!

Usage:
  python seed_data.py
"""

import sys
import io

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from datetime import date
from app.database import SessionLocal, engine, Base
from app.models.room import Room
from app.models.department import Department
from app.models.exam_session import ExamSession
from app.models.exam_entry import ExamEntry
import app.crud.seating_plans as plan_crud
from app.algorithm.seating import generate_seating
from app.algorithm.roll_numbers import generate_rolls
from app.algorithm.models import DeptGroup, RoomSpec


def seed_database():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("[+] Seeding Exam Seating Arrangement System...")

        # ── 1. Seed 4 Departments ─────────────────────────────────────────────
        dept_data = [
            ("Computer Science and Engineering", "CSE"),
            ("Electronics and Communication Engineering", "ECE"),
            ("Mechanical Engineering", "MECH"),
            ("Civil Engineering", "CIVIL"),
        ]
        dept_objs = {}
        for name, code in dept_data:
            existing = db.query(Department).filter(Department.code == code).first()
            if not existing:
                dept = Department(name=name, code=code)
                db.add(dept)
                db.flush()
                dept_objs[code] = dept
                print(f"  + Added Department: {code} ({name})")
            else:
                dept_objs[code] = existing
                print(f"  * Department already exists: {code}")

        # ── 2. Seed 6 Examination Halls ──────────────────────────────────────
        room_data = [
            ("Hall A", 8, 5, 2, "Dr. Ramesh Kumar"),       # 80 seats
            ("Hall B", 6, 5, 2, "Dr. Priya Sharma"),        # 60 seats
            ("Hall C", 7, 4, 2, "Prof. Anand Verma"),       # 56 seats
            ("Hall D", 5, 4, 3, "Dr. Meenakshi Sundaram"),  # 60 seats (3-seater benches)
            ("Hall 101", 6, 6, 1, "Dr. Suresh Menon"),      # 36 seats (1-seater benches)
            ("Auditorium", 10, 6, 2, "Prof. Vikram Reddy"), # 120 seats
        ]
        room_objs = []
        for name, r, c, spb, invig in room_data:
            existing = db.query(Room).filter(Room.name == name).first()
            if not existing:
                room = Room(
                    name=name,
                    rows=r,
                    columns=c,
                    seats_per_bench=spb,
                    invigilator_name=invig,
                )
                db.add(room)
                db.flush()
                room_objs.append(room)
                print(f"  + Added Room: {name} (Capacity: {r * c * spb} seats, Invigilator: {invig})")
            else:
                room_objs.append(existing)
                print(f"  * Room already exists: {name}")

        # ── 3. Seed Exam Session ──────────────────────────────────────────────
        session_date = date(2025, 5, 15)
        session_label = "FN"
        session = (
            db.query(ExamSession)
            .filter(ExamSession.date == session_date, ExamSession.label == session_label)
            .first()
        )
        if not session:
            session = ExamSession(date=session_date, label=session_label)
            db.add(session)
            db.flush()
            print(f"  + Added Exam Session: {session_date} ({session_label})")
        else:
            print(f"  * Session already exists: {session_date} ({session_label})")

        # ── 4. Seed 4 Exam Entries ────────────────────────────────────────────
        entries_data = [
            ("CSE", "Data Structures & Algorithms", 45, "21CSE001", "21CSE045"),
            ("ECE", "Signals and Systems", 40, "21ECE001", "21ECE040"),
            ("MECH", "Thermodynamics", 35, "21MECH001", "21MECH035"),
            ("CIVIL", "Structural Engineering", 30, "21CIVIL001", "21CIVIL030"),
        ]
        for dept_code, subj, count, rs, re in entries_data:
            dept = dept_objs[dept_code]
            existing_entry = (
                db.query(ExamEntry)
                .filter(
                    ExamEntry.session_id == session.id,
                    ExamEntry.department_id == dept.id,
                    ExamEntry.subject == subj,
                )
                .first()
            )
            if not existing_entry:
                entry = ExamEntry(
                    session_id=session.id,
                    department_id=dept.id,
                    subject=subj,
                    student_count=count,
                    roll_start=rs,
                    roll_end=re,
                )
                db.add(entry)
                print(f"  + Added Entry: {dept_code} - {subj} ({count} candidates)")
            else:
                print(f"  * Entry already exists: {dept_code} - {subj}")

        db.commit()

        # ── 5. Auto-Generate Seating Plan for this session ──────────────────────
        print("\n[*] Generating Seating Plan for Session...")
        all_entries = (
            db.query(ExamEntry)
            .filter(ExamEntry.session_id == session.id)
            .all()
        )

        dept_groups = []
        for e in all_entries:
            rolls = generate_rolls(
                e.department.code,
                e.student_count,
                e.roll_start,
                e.roll_end,
            )
            dept_groups.append(
                DeptGroup(
                    dept_id=e.department_id,
                    dept_code=e.department.code,
                    subject=e.subject,
                    rolls=rolls,
                )
            )

        room_specs = [
            RoomSpec(
                room_id=r.id,
                room_name=r.name,
                rows=r.rows,
                cols=r.columns,
                seats_per_bench=r.seats_per_bench,
                invigilator_name=r.invigilator_name,
            )
            for r in room_objs[:3]  # Use first 3 halls (Hall A, B, C = 196 capacity > 150 candidates)
        ]

        result = generate_seating(dept_groups, room_specs, check_front_back=True)
        plan = plan_crud.save_plan(db, session.id, result)

        print(f"[OK] Seating Plan created (Plan ID: {plan.id})")
        print(f"  - Rooms Allocated: {result.rooms_used}")
        print(f"  - Total Candidates Seated: {result.total_assigned}")
        print(f"  - Unseated Count: {result.unseated_count}")
        for r_res in result.room_results:
            print(f"    * {r_res.room_name}: {r_res.assigned}/{r_res.capacity} ({r_res.utilization_pct}%)")

        print("\n[SUCCESS] Seeding complete! Database is primed and ready.")

    except Exception as exc:
        db.rollback()
        print(f"[ERROR] Error during seeding: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
