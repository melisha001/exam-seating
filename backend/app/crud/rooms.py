"""
crud/rooms.py — Database operations for Room.
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.room import Room
from app.schemas.room import RoomCreate, RoomUpdate


def get_rooms(db: Session, skip: int = 0, limit: int = 100) -> list[Room]:
    return db.query(Room).offset(skip).limit(limit).all()


def get_room(db: Session, room_id: int) -> Room | None:
    return db.get(Room, room_id)


def create_room(db: Session, data: RoomCreate) -> Room:
    room = Room(**data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def update_room(db: Session, room: Room, data: RoomUpdate) -> Room:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, room: Room) -> None:
    db.delete(room)
    db.commit()
