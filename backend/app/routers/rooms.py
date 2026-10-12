"""
routers/rooms.py — FastAPI routes for Room CRUD.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate
import app.crud.rooms as crud

router = APIRouter(prefix="/rooms", tags=["Rooms"])


def _get_or_404(db: Session, room_id: int):
    room = crud.get_room(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found.")
    return room


@router.get("/", response_model=list[RoomRead])
def list_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Return all rooms, ordered by id."""
    return crud.get_rooms(db, skip=skip, limit=limit)


@router.post("/", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(data: RoomCreate, db: Session = Depends(get_db)):
    """Create a new room. Room name must be unique."""
    try:
        return crud.create_room(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A room named '{data.name}' already exists.",
        )


@router.get("/{room_id}", response_model=RoomRead)
def get_room(room_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, room_id)


@router.put("/{room_id}", response_model=RoomRead)
def update_room(room_id: int, data: RoomUpdate, db: Session = Depends(get_db)):
    room = _get_or_404(db, room_id)
    try:
        return crud.update_room(db, room, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A room named '{data.name}' already exists.",
        )


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = _get_or_404(db, room_id)
    crud.delete_room(db, room)
