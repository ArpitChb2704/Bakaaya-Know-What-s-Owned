"""
POST /api/smart-entry/parse  → parse text, return structured preview
POST /api/smart-entry/confirm → actually save the transaction
"""
from datetime import date as date_type
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Party, Transaction, PartyType, TransactionType
from app.schemas import SmartEntryRequest, SmartEntryResponse, SmartEntryParsed, TransactionOut
from app.services.smart_entry import parse_entry

router = APIRouter(prefix="/api/smart-entry", tags=["smart-entry"])


@router.post("/parse", response_model=SmartEntryResponse)
def parse(
    payload: SmartEntryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        parsed = parse_entry(payload.text)
        return SmartEntryResponse(
            parsed=SmartEntryParsed(
                **parsed,
                raw_text=payload.text,
            )
        )
    except Exception as e:
        return SmartEntryResponse(error=str(e))


@router.post("/confirm", response_model=TransactionOut)
def confirm(
    payload: SmartEntryParsed,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find or create party
    party = (
        db.query(Party)
        .filter(
            Party.owner_id == current_user.id,
            Party.name.ilike(f"%{payload.party_name}%"),
        )
        .first()
    )

    if not party:
        party = Party(
            owner_id=current_user.id,
            name=payload.party_name,
            party_type=payload.party_type,
        )
        db.add(party)
        db.flush()

    txn = Transaction(
        owner_id=current_user.id,
        party_id=party.id,
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        transaction_date=payload.transaction_date,
        notes=payload.notes,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
