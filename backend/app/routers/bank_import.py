from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.auth import get_current_user, get_business_owner_id, require_active_plan
from app.database import get_db
from app.models import User, Party, Transaction, PartyType
from app.services.bank_import import parse_csv, match_with_ai
from app.schemas import BankImportConfirm, TransactionOut

router = APIRouter(prefix="/api/bank-import", tags=["bank-import"])


@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 2MB.")

    owner_id = get_business_owner_id(current_user)

    try:
        rows = parse_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {str(e)}")

    if not rows:
        raise HTTPException(status_code=400, detail="No valid transactions found in this CSV. Check the format.")

    parties = db.query(Party).filter(Party.owner_id == owner_id, Party.is_archived == False).all()
    matched = match_with_ai(rows, parties)

    return {"rows": matched, "total": len(matched), "matched": sum(1 for m in matched if m.get("matched_party_id"))}


@router.post("/confirm", response_model=List[TransactionOut])
def confirm_import(
    payload: BankImportConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    owner_id = get_business_owner_id(current_user)
    saved = []

    for match in payload.matches:
        if not match.selected or not match.matched_party_id or not match.suggested_type:
            continue

        party = db.query(Party).filter(Party.id == match.matched_party_id, Party.owner_id == owner_id).first()
        if not party:
            continue

        row = match.row
        txn = Transaction(
            owner_id=owner_id,
            party_id=party.id,
            transaction_type=match.suggested_type,
            amount=row.amount,
            transaction_date=row.date,
            notes=f"Bank import: {row.description[:80]}",
            created_by=current_user.id,
            approved=True,
        )
        db.add(txn)
        saved.append(txn)

    db.commit()
    for t in saved:
        db.refresh(t)
    return saved
