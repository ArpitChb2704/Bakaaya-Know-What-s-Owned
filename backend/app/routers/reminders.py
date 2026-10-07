from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.auth import get_current_user, require_active_plan
from app.database import get_db
from app.models import User, Reminder, Party
from app.schemas import ReminderCreate, ReminderUpdate, ReminderOut

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("", response_model=List[ReminderOut])
def list_reminders(
    party_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    q = db.query(Reminder).filter(Reminder.owner_id == current_user.id)
    if party_id:
        q = q.filter(Reminder.party_id == party_id)
    return q.order_by(Reminder.created_at.desc()).all()


@router.post("", response_model=ReminderOut)
def create_reminder(
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = db.query(Party).filter(
        Party.id == payload.party_id, Party.owner_id == current_user.id
    ).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    r = Reminder(owner_id=current_user.id, **payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    r = db.query(Reminder).filter(
        Reminder.id == reminder_id, Reminder.owner_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, f, v)
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    r = db.query(Reminder).filter(
        Reminder.id == reminder_id, Reminder.owner_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
