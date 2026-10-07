from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.auth import get_current_user, require_active_plan
from app.database import get_db
from app.models import Party, User, PartyType, Transaction, TransactionType
from app.schemas import PartyCreate, PartyUpdate, PartyOut, RiskOut
from app.services.ledger import party_balance, is_overdue
from app.services.risk import compute_risk

router = APIRouter(prefix="/api/parties", tags=["parties"])


def _days_outstanding(db: Session, party_id: int) -> Optional[int]:
    from sqlalchemy import func
    oldest = (
        db.query(func.min(Transaction.transaction_date))
        .filter(
            Transaction.party_id == party_id,
            Transaction.transaction_type.in_([TransactionType.bill, TransactionType.sale]),
        )
        .scalar()
    )
    if not oldest:
        return None
    return (date.today() - oldest).days


def _build_out(db, party) -> PartyOut:
    out = PartyOut.model_validate(party)
    out.balance = party_balance(db, party.id)
    out.days_outstanding = _days_outstanding(db, party.id) if out.balance > 0 else None
    return out


@router.get("", response_model=List[PartyOut])
def list_parties(
    party_type: Optional[PartyType] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    q = db.query(Party).filter(Party.owner_id == current_user.id)
    if party_type:
        q = q.filter(Party.party_type == party_type)
    if not include_archived:
        q = q.filter(Party.is_archived == False)
    parties = q.order_by(Party.name).all()
    return [_build_out(db, p) for p in parties]


@router.post("", response_model=PartyOut)
def create_party(
    payload: PartyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = Party(owner_id=current_user.id, **payload.model_dump())
    db.add(party)
    db.commit()
    db.refresh(party)
    return _build_out(db, party)


@router.get("/{party_id}", response_model=PartyOut)
def get_party(
    party_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = db.query(Party).filter(
        Party.id == party_id, Party.owner_id == current_user.id
    ).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    return _build_out(db, party)


@router.patch("/{party_id}", response_model=PartyOut)
def update_party(
    party_id: int,
    payload: PartyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = db.query(Party).filter(
        Party.id == party_id, Party.owner_id == current_user.id
    ).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(party, f, v)
    db.commit()
    db.refresh(party)
    return _build_out(db, party)


@router.delete("/{party_id}")
def delete_party(
    party_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = db.query(Party).filter(
        Party.id == party_id, Party.owner_id == current_user.id
    ).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    db.delete(party)
    db.commit()
    return {"ok": True}


@router.post("/{party_id}/risk", response_model=RiskOut)
def refresh_risk(
    party_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    party = db.query(Party).filter(
        Party.id == party_id, Party.owner_id == current_user.id
    ).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    result = compute_risk(db, party)
    party.risk_score = result["risk_score"]
    party.risk_label = result["risk_label"]
    party.risk_reasons = json.dumps(result["risk_reasons"])
    db.commit()

    return RiskOut(party_id=party_id, **result)
