from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.auth import get_current_user, get_business_owner_id, can_approve_transaction
from app.database import get_db
from app.models import Transaction, Party, User, TransactionType
from app.schemas import TransactionCreate, TransactionUpdate, TransactionOut, DuplicateCheck

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

APPROVAL_THRESHOLD = 10000


def _check_duplicate(db, owner_id, party_id, amount, txn_type, txn_date) -> dict:
    from datetime import timedelta
    window_start = txn_date - timedelta(days=3)
    window_end = txn_date + timedelta(days=3)
    existing = db.query(Transaction).filter(
        Transaction.owner_id == owner_id,
        Transaction.party_id == party_id,
        Transaction.transaction_type == txn_type,
        Transaction.amount == amount,
        Transaction.transaction_date >= window_start,
        Transaction.transaction_date <= window_end,
    ).first()
    if existing:
        return {"is_duplicate": True, "existing_id": existing.id, "existing_date": existing.transaction_date, "existing_notes": existing.notes}
    return {"is_duplicate": False}


@router.get("", response_model=List[TransactionOut])
def list_transactions(party_id: Optional[int] = None, limit: int = 200,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    q = db.query(Transaction).filter(Transaction.owner_id == owner_id)
    if party_id:
        q = q.filter(Transaction.party_id == party_id)
    return q.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).limit(limit).all()


@router.post("/check-duplicate", response_model=DuplicateCheck)
def check_duplicate(payload: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    result = _check_duplicate(db, owner_id, payload.party_id, payload.amount, payload.transaction_type, payload.transaction_date)
    return DuplicateCheck(**result)


@router.post("", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    party = db.query(Party).filter(Party.id == payload.party_id, Party.owner_id == owner_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    needs_approval = not can_approve_transaction(current_user, float(payload.amount))
    txn = Transaction(owner_id=owner_id, created_by=current_user.id,
        requires_approval=needs_approval, approved=None if needs_approval else True,
        **payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, payload: TransactionUpdate,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    txn = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.owner_id == owner_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for f, v in payload.model_dump(exclude_unset=True).items():
        setattr(txn, f, v)
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{transaction_id}/approve", response_model=TransactionOut)
def approve_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import UserRole
    if current_user.role != UserRole.owner:
        raise HTTPException(status_code=403, detail="Only the owner can approve transactions")
    owner_id = get_business_owner_id(current_user)
    txn = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.owner_id == owner_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn.approved = True
    txn.requires_approval = False
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    txn = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.owner_id == owner_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"ok": True}
