from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from fastapi.responses import StreamingResponse
from io import BytesIO
from app.services.statement_pdf import generate_statement_pdf
from decimal import Decimal
from fastapi import Response

from app.auth import get_current_user, get_business_owner_id
from app.database import get_db
from app.models import User, Party, Transaction, PartyType
from app.schemas import CashflowForecast, SupplierScore, StatementRequest, UPILinkRequest, UPILinkResponse
from app.services.cashflow import forecast
from app.services.supplier_score import score_supplier
from app.services.ledger import party_balance

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/cashflow", response_model=CashflowForecast)
def get_cashflow(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    result = forecast(db, owner_id)
    return result


@router.get("/supplier-scores", response_model=List[SupplierScore])
def get_supplier_scores(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    suppliers = db.query(Party).filter(
        Party.owner_id == owner_id,
        Party.party_type == PartyType.supplier,
        Party.is_archived == False,
    ).all()
    scores = []
    for s in suppliers:
        score = score_supplier(db, s)
        if score:
            scores.append(score)
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores


@router.post("/statement")
def get_statement(
    payload: StatementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner_id = get_business_owner_id(current_user)
    party = db.query(Party).filter(Party.id == payload.party_id, Party.owner_id == owner_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    from app.models import User as UserModel
    owner = db.query(UserModel).filter(UserModel.id == owner_id).first()

    from_date = payload.from_date
    to_date = payload.to_date or date.today()

    # Opening balance: net of all transactions strictly before from_date
    opening_balance = Decimal("0")
    if from_date:
        prior = db.query(Transaction).filter(
            Transaction.party_id == party.id,
            Transaction.transaction_date < from_date,
        ).all()
        for t in prior:
            if t.transaction_type.value in ("bill", "sale"):
                opening_balance += t.amount
            else:
                opening_balance -= t.amount

    q = db.query(Transaction).filter(Transaction.party_id == party.id)
    if from_date:
        q = q.filter(Transaction.transaction_date >= from_date)
    if payload.to_date:
        q = q.filter(Transaction.transaction_date <= payload.to_date)
    txns = q.order_by(Transaction.transaction_date).all()

    txn_dicts = [{"transaction_date": str(t.transaction_date), "transaction_type": t.transaction_type.value,
                  "amount": str(t.amount), "notes": t.notes} for t in txns]

    total_debit = sum(t.amount for t in txns if t.transaction_type.value in ("bill", "sale"))
    total_credit = sum(t.amount for t in txns if t.transaction_type.value not in ("bill", "sale"))

    from_date = from_date or (txns[0].transaction_date if txns else date.today())

    pdf_bytes = generate_statement_pdf(
        party_name=party.name,
        party_gst=party.gst_number,
        party_location=getattr(party, "location", None),
        business_name=owner.business_name if owner else "Business",
        transactions=txn_dicts,
        from_date=str(from_date),
        to_date=str(to_date),
        opening_balance=opening_balance,
        total_debit=total_debit,
        total_credit=total_credit,
        closing_balance=party_balance(db, party.id),
    )
    return Response(content=pdf_bytes, media_type="application/pdf")

@router.post("/upi-link", response_model=UPILinkResponse)
def generate_upi_link(
    payload: UPILinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner_id = get_business_owner_id(current_user)
    party = db.query(Party).filter(Party.id == payload.party_id, Party.owner_id == owner_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    balance = payload.amount or party_balance(db, party.id)
    if balance <= 0:
        raise HTTPException(status_code=400, detail="No outstanding balance for this party.")

    amount_str = f"{float(balance):.2f}"
    upi_id = payload.upi_id.strip()
    from app.models import User as UserModel
    owner = db.query(UserModel).filter(UserModel.id == owner_id).first()
    business = owner.business_name if owner else "Business"

    # Standard UPI deep link format
    upi_link = (
        f"upi://pay?pa={upi_id}"
        f"&pn={business.replace(' ', '%20')}"
        f"&am={amount_str}"
        f"&cu=INR"
        f"&tn=Payment%20from%20{party.name.replace(' ', '%20')}"
    )

    whatsapp_msg = (
        f"Hi, please pay ₹{int(balance):,} outstanding to {business}.\n\n"
        f"Pay via UPI:\n{upi_link}\n\n"
        f"UPI ID: {upi_id}"
    )

    return UPILinkResponse(
        upi_link=upi_link,
        whatsapp_message=whatsapp_msg,
        amount=balance,
        party_name=party.name,
    )
