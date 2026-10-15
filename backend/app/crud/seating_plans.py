"""
crud/seating_plans.py — DB operations for SeatingPlan and SeatAssignment.
"""

from sqlalchemy.orm import Session, joinedload

from app.models.seating_plan import SeatingPlan, SeatAssignment
from app.algorithm.models import SeatingResult, RoomResult, SeatInfo


def get_plan_by_session(db: Session, session_id: int) -> SeatingPlan | None:
    return (
        db.query(SeatingPlan)
        .filter(SeatingPlan.session_id == session_id)
        .first()
    )


def get_plan_by_id(db: Session, plan_id: int) -> SeatingPlan | None:
    return db.get(SeatingPlan, plan_id)


def get_seat(db: Session, seat_id: int) -> SeatAssignment | None:
    return db.get(SeatAssignment, seat_id)


def delete_plan(db: Session, plan: SeatingPlan) -> None:
    db.delete(plan)
    db.commit()


def save_plan(
    db: Session,
    session_id: int,
    result: SeatingResult,
) -> SeatingPlan:
    """
    Persist a SeatingResult produced by the algorithm into the database.

    If a plan already exists for this session it is deleted first
    (regeneration replaces the previous plan).
    """
    # Remove any existing plan for this session
    existing = get_plan_by_session(db, session_id)
    if existing:
        db.delete(existing)
        db.flush()

    plan = SeatingPlan(session_id=session_id, unseated_count=result.unseated_count)
    plan.warnings = result.warnings
    db.add(plan)
    db.flush()   # get plan.id before inserting children

    for room_result in result.room_results:
        for seat in room_result.seats:
            sa = SeatAssignment(
                plan_id=plan.id,
                room_id=room_result.room_id,
                row=seat.row,
                col=seat.col,
                seat_index=seat.seat_index,
                roll_number=seat.roll_number,
                department_id=seat.dept_id,
                subject=seat.subject,
                subject_code=seat.subject_code,
                is_empty=seat.is_empty,
                is_arrear=seat.is_arrear,
                is_locked=seat.is_locked,
                medium=seat.medium or "EN",
                seat_label=seat.seat_label or "",
            )
            db.add(sa)

    db.commit()
    db.refresh(plan)
    return plan


def get_seats_for_plan(db: Session, plan_id: int) -> list[SeatAssignment]:
    return (
        db.query(SeatAssignment)
        .filter(SeatAssignment.plan_id == plan_id)
        .order_by(SeatAssignment.room_id, SeatAssignment.row,
                  SeatAssignment.col, SeatAssignment.seat_index)
        .all()
    )


def get_seats_for_room(
    db: Session, plan_id: int, room_id: int
) -> list[SeatAssignment]:
    return (
        db.query(SeatAssignment)
        .filter(
            SeatAssignment.plan_id == plan_id,
            SeatAssignment.room_id == room_id,
        )
        .order_by(SeatAssignment.row, SeatAssignment.col, SeatAssignment.seat_index)
        .all()
    )
