"""
routers/plans.py — FastAPI routes for seating plan generation, retrieval,
                   seat swapping, and PDF/Excel export.

Endpoints
---------
POST   /plans/generate               Generate (or regenerate) a plan for a session
GET    /plans/session/{session_id}   Retrieve the plan for a session
PUT    /plans/{plan_id}/swap         Manually swap two seats (re-validates constraints)
GET    /plans/{plan_id}/export/pdf   Download PDF
GET    /plans/{plan_id}/export/excel Download Excel
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.room import Room
from app.models.department import Department
from app.models.seating_plan import SeatingPlan, SeatAssignment

import app.crud.exam_sessions as session_crud
import app.crud.exam_entries as entry_crud
import app.crud.rooms as room_crud
import app.crud.seating_plans as plan_crud

from app.algorithm.seating import generate_seating
from app.algorithm.roll_numbers import generate_rolls
from app.algorithm.models import DeptGroup, RoomSpec
from app.algorithm.adjacency import get_neighbors

from app.services.export_pdf import generate_pdf
from app.services.export_excel import generate_excel

from app.schemas.plan_request import (
    GeneratePlanRequest, SwapRequest, PlanSummary, PlanDetail, RoomGrid
)

router = APIRouter(prefix="/plans", tags=["Seating Plans"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _plan_or_404(db: Session, plan_id: int) -> SeatingPlan:
    plan = plan_crud.get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found.")
    return plan


def _seat_or_404(db: Session, seat_id: int) -> SeatAssignment:
    seat = plan_crud.get_seat(db, seat_id)
    if not seat:
        raise HTTPException(status_code=404, detail=f"Seat {seat_id} not found.")
    return seat


def _build_plan_detail(plan: SeatingPlan, db: Session) -> PlanDetail:
    """Construct a PlanDetail response from a SeatingPlan ORM object."""
    all_seats = plan_crud.get_seats_for_plan(db, plan.id)

    # Group seats by room
    room_ids_ordered: list[int] = []
    seats_by_room: dict[int, list[SeatAssignment]] = {}
    for seat in all_seats:
        if seat.room_id not in seats_by_room:
            room_ids_ordered.append(seat.room_id)
            seats_by_room[seat.room_id] = []
        seats_by_room[seat.room_id].append(seat)

    room_grids: list[RoomGrid] = []
    for rid in room_ids_ordered:
        room: Room = room_crud.get_room(db, rid)
        r_seats = seats_by_room[rid]
        used = sum(1 for s in r_seats if not s.is_empty)
        cap = room.capacity
        util = round(used / cap * 100, 1) if cap else 0.0

        seat_dicts = [
            {
                "id": s.id,
                "plan_id": s.plan_id,
                "room_id": s.room_id,
                "row": s.row,
                "col": s.col,
                "seat_index": s.seat_index,
                "roll_number": s.roll_number,
                "department_id": s.department_id,
                "subject": s.subject,
                "is_empty": s.is_empty,
            }
            for s in r_seats
        ]
        room_grids.append(RoomGrid(
            room_id=rid,
            room_name=room.name,
            invigilator_name=room.invigilator_name,
            capacity=cap,
            assigned=used,
            utilization_pct=util,
            seats=seat_dicts,
        ))

    return PlanDetail(
        plan_id=plan.id,
        session_id=plan.session_id,
        rooms_used=len(room_ids_ordered),
        total_assigned=sum(rg.assigned for rg in room_grids),
        unseated_count=plan.unseated_count,
        warnings=plan.warnings,
        rooms=room_grids,
    )


def _validate_swap_constraints(
    seat_a: SeatAssignment,
    seat_b: SeatAssignment,
    all_seats: list[SeatAssignment],
    db: Session,
) -> list[str]:
    """
    Simulate swapping seats A and B and return a list of constraint violations.
    An empty list means the swap is valid.
    """
    # Build a grid of the current plan with the swap applied
    grid: dict[tuple, SeatAssignment] = {}
    for seat in all_seats:
        if seat.id == seat_a.id:
            # Pretend seat_b's student sits here
            mock = SeatAssignment(
                id=seat.id, plan_id=seat.plan_id, room_id=seat.room_id,
                row=seat.row, col=seat.col, seat_index=seat.seat_index,
                roll_number=seat_b.roll_number,
                department_id=seat_b.department_id,
                subject=seat_b.subject,
                is_empty=seat_b.is_empty,
            )
            grid[(seat.room_id, seat.row, seat.col, seat.seat_index)] = mock
        elif seat.id == seat_b.id:
            mock = SeatAssignment(
                id=seat.id, plan_id=seat.plan_id, room_id=seat.room_id,
                row=seat.row, col=seat.col, seat_index=seat.seat_index,
                roll_number=seat_a.roll_number,
                department_id=seat_a.department_id,
                subject=seat_a.subject,
                is_empty=seat_a.is_empty,
            )
            grid[(seat.room_id, seat.row, seat.col, seat.seat_index)] = mock
        else:
            grid[(seat.room_id, seat.row, seat.col, seat.seat_index)] = seat

    violations: list[str] = []

    def check_seat(seat: SeatAssignment, room: Room) -> None:
        if seat.is_empty:
            return
        neighbors = get_neighbors(
            seat.row, seat.col, seat.seat_index,
            room.rows, room.columns, room.seats_per_bench,
            check_front_back=True,
        )
        for nr, nc, ns in neighbors:
            n = grid.get((seat.room_id, nr, nc, ns))
            if n and not n.is_empty:
                if n.department_id == seat.department_id:
                    violations.append(
                        f"Same department adjacent: "
                        f"{seat.roll_number} ↔ {n.roll_number}"
                    )
                elif n.subject and seat.subject and n.subject == seat.subject:
                    violations.append(
                        f"Same subject '{seat.subject}' adjacent: "
                        f"{seat.roll_number} ↔ {n.roll_number}"
                    )

    for target_seat_id in (seat_a.id, seat_b.id):
        target = grid.get(
            (seat_a.room_id, seat_a.row, seat_a.col, seat_a.seat_index)
            if target_seat_id == seat_a.id
            else (seat_b.room_id, seat_b.row, seat_b.col, seat_b.seat_index)
        )
        if target:
            room = room_crud.get_room(db, target.room_id)
            if room:
                check_seat(target, room)

    # Deduplicate (each violation appears once per direction)
    return list(dict.fromkeys(violations))


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=PlanDetail, status_code=status.HTTP_201_CREATED)
def generate_plan(body: GeneratePlanRequest, db: Session = Depends(get_db)):
    """
    Generate (or regenerate) a seating plan for a session.

    - Fetches all ExamEntry records for the session.
    - Builds DeptGroup / RoomSpec objects.
    - Runs the greedy algorithm.
    - Persists the result to the database (replaces any existing plan).
    """
    # Validate session
    session = session_crud.get_session(db, body.session_id)
    if not session:
        raise HTTPException(404, f"Session {body.session_id} not found.")

    # Validate and load rooms in requested order
    rooms: list[Room] = []
    for rid in body.room_ids:
        room = room_crud.get_room(db, rid)
        if not room:
            raise HTTPException(422, f"Room {rid} not found.")
        rooms.append(room)

    # Load exam entries
    entries = entry_crud.get_entries(db, session_id=body.session_id)
    if not entries:
        raise HTTPException(
            422,
            f"Session {body.session_id} has no exam entries. "
            "Add departments and student counts before generating a plan.",
        )

    # Build algorithm inputs
    dept_groups: list[DeptGroup] = []
    for entry in entries:
        rolls = generate_rolls(
            entry.department.code,
            entry.student_count,
            entry.roll_start,
            entry.roll_end,
        )
        dept_groups.append(DeptGroup(
            dept_id=entry.department_id,
            dept_code=entry.department.code,
            subject=entry.subject,
            rolls=rolls,
        ))

    room_specs: list[RoomSpec] = [
        RoomSpec(
            room_id=r.id,
            room_name=r.name,
            rows=r.rows,
            cols=r.columns,
            seats_per_bench=r.seats_per_bench,
            invigilator_name=r.invigilator_name,
        )
        for r in rooms
    ]

    # Run algorithm
    result = generate_seating(dept_groups, room_specs, check_front_back=body.check_front_back)

    # Persist
    plan = plan_crud.save_plan(db, body.session_id, result)
    return _build_plan_detail(plan, db)


@router.get("/session/{session_id}", response_model=PlanDetail)
def get_plan_by_session(session_id: int, db: Session = Depends(get_db)):
    """Retrieve the seating plan for a given session."""
    plan = plan_crud.get_plan_by_session(db, session_id)
    if not plan:
        raise HTTPException(
            404,
            f"No seating plan found for session {session_id}. "
            "Generate one first via POST /plans/generate.",
        )
    return _build_plan_detail(plan, db)


@router.put("/{plan_id}/swap", response_model=dict)
def swap_seats(plan_id: int, body: SwapRequest, db: Session = Depends(get_db)):
    """
    Manually swap the students in two seats.

    Validates all adjacency constraints after the swap.
    Returns 409 with violation details if the swap would break a rule.
    """
    plan = _plan_or_404(db, plan_id)
    seat_a = _seat_or_404(db, body.seat_id_a)
    seat_b = _seat_or_404(db, body.seat_id_b)

    # Both seats must belong to this plan
    for seat in (seat_a, seat_b):
        if seat.plan_id != plan_id:
            raise HTTPException(
                422,
                f"Seat {seat.id} does not belong to plan {plan_id}.",
            )

    all_seats = plan_crud.get_seats_for_plan(db, plan_id)
    violations = _validate_swap_constraints(seat_a, seat_b, all_seats, db)

    if violations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Swap rejected: constraint violation(s) detected.",
                "violations": violations,
            },
        )

    # Apply the swap
    (
        seat_a.roll_number, seat_b.roll_number,
        seat_a.department_id, seat_b.department_id,
        seat_a.subject, seat_b.subject,
        seat_a.is_empty, seat_b.is_empty,
    ) = (
        seat_b.roll_number, seat_a.roll_number,
        seat_b.department_id, seat_a.department_id,
        seat_b.subject, seat_a.subject,
        seat_b.is_empty, seat_a.is_empty,
    )
    db.commit()

    return {
        "message": "Swap applied successfully.",
        "seat_a_id": seat_a.id,
        "seat_b_id": seat_b.id,
    }


# ── Export endpoints ──────────────────────────────────────────────────────────

@router.get("/{plan_id}/export/pdf")
def export_pdf(plan_id: int, db: Session = Depends(get_db)):
    """Download the seating plan as a PDF (one landscape A4 page per room)."""
    plan = _plan_or_404(db, plan_id)
    all_seats = plan_crud.get_seats_for_plan(db, plan_id)

    # Collect unique room IDs in order
    room_ids_ordered: list[int] = []
    seats_by_room: dict[int, list[SeatAssignment]] = {}
    for seat in all_seats:
        if seat.room_id not in seats_by_room:
            room_ids_ordered.append(seat.room_id)
            seats_by_room[seat.room_id] = []
        seats_by_room[seat.room_id].append(seat)

    rooms = [room_crud.get_room(db, rid) for rid in room_ids_ordered]

    pdf_bytes = generate_pdf(plan, rooms, seats_by_room)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="seating_plan_{plan_id}.pdf"'
        },
    )


@router.get("/{plan_id}/export/excel")
def export_excel(plan_id: int, db: Session = Depends(get_db)):
    """Download the seating plan as an Excel workbook."""
    plan = _plan_or_404(db, plan_id)
    all_seats = plan_crud.get_seats_for_plan(db, plan_id)

    room_ids_ordered: list[int] = []
    seats_by_room: dict[int, list[SeatAssignment]] = {}
    for seat in all_seats:
        if seat.room_id not in seats_by_room:
            room_ids_ordered.append(seat.room_id)
            seats_by_room[seat.room_id] = []
        seats_by_room[seat.room_id].append(seat)

    rooms = [room_crud.get_room(db, rid) for rid in room_ids_ordered]

    xlsx_bytes = generate_excel(plan, rooms, seats_by_room)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="seating_plan_{plan_id}.xlsx"'
        },
    )
