from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import SKU, TransactionItem
from datetime import datetime

from app.auth import get_current_user, get_business_owner_id, can_approve_transaction, require_active_plan
from app.database import get_db
from app.models import Transaction, Party, User, TransactionType
from app.schemas import TransactionCreate, TransactionUpdate, TransactionOut, DuplicateCheck
from fastapi import Response
from app.services.invoice_pdf import generate_invoice_pdf, generate_qr_data_uri

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

APPROVAL_THRESHOLD = 10000

def generate_invoice_number(db: Session, owner_id: int) -> str:
    year = datetime.now().year
    count = db.query(Transaction).filter(
        Transaction.owner_id == owner_id,
        Transaction.invoice_number.isnot(None),
        Transaction.invoice_number.like(f"INV-{year}-%"),
    ).count()
    return f"INV-{year}-{count + 1:04d}"

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
    db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
    owner_id = get_business_owner_id(current_user)
    q = db.query(Transaction).filter(Transaction.owner_id == owner_id)
    if party_id:
        q = q.filter(Transaction.party_id == party_id)
    return q.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).limit(limit).all()


@router.post("/check-duplicate", response_model=DuplicateCheck)
def check_duplicate(payload: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
    owner_id = get_business_owner_id(current_user)
    result = _check_duplicate(db, owner_id, payload.party_id, payload.amount, payload.transaction_type, payload.transaction_date)
    return DuplicateCheck(**result)


@router.post("", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
    owner_id = get_business_owner_id(current_user)
    party = db.query(Party).filter(Party.id == payload.party_id, Party.owner_id == owner_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    items_payload = payload.items
    txn_data = payload.model_dump(exclude={"items"})

    if items_payload:
        computed_total = sum(i.quantity * i.unit_price for i in items_payload)
        if computed_total != txn_data["amount"]:
            raise HTTPException(
                status_code=400,
                detail=f"Item totals (₹{computed_total}) don't match transaction amount (₹{txn_data['amount']})."
            )

    needs_approval = not can_approve_transaction(current_user, float(payload.amount))
    invoice_number = generate_invoice_number(db, owner_id) if items_payload else None
    txn = Transaction(owner_id=owner_id, created_by=current_user.id,
        requires_approval=needs_approval, approved=None if needs_approval else True, invoice_number=invoice_number,
        **txn_data)
    db.add(txn)
    db.flush()  # assigns txn.id without committing yet

    if items_payload:
        for item in items_payload:
            unit_cost = None
            if item.sku_id:
                sku = db.query(SKU).filter(SKU.id == item.sku_id, SKU.owner_id == owner_id).first()
                if sku:
                    unit_cost = sku.cost_price
            db.add(TransactionItem(
                transaction_id=txn.id,
                sku_id=item.sku_id,
                item_name=item.item_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                unit_cost=unit_cost,
                line_total=item.quantity * item.unit_price,
            ))

    db.commit()
    db.refresh(txn)
    return txn


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, payload: TransactionUpdate,
    db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
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
def approve_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
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
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
    owner_id = get_business_owner_id(current_user)
    txn = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.owner_id == owner_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"ok": True}


@router.get("/{transaction_id}/invoice")
def get_invoice_pdf(transaction_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_active_plan)):
    owner_id = get_business_owner_id(current_user)
    txn = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.owner_id == owner_id).first()
    if not txn or not txn.invoice_number:
        raise HTTPException(status_code=404, detail="Invoice not found")

    party = db.query(Party).filter(Party.id == txn.party_id).first()
    owner = db.query(User).filter(User.id == owner_id).first()
    items = db.query(TransactionItem).filter(TransactionItem.transaction_id == txn.id).all()
    item_dicts = [{"item_name": i.item_name, "quantity": i.quantity, "unit_price": i.unit_price, "line_total": i.line_total} for i in items]

    qr_data_uri = None
    if owner and owner.upi_id:
        upi_link = f"upi://pay?pa={owner.upi_id}&pn={(owner.business_name or 'Business').replace(' ', '%20')}&am={float(txn.amount):.2f}&cu=INR"
        qr_data_uri = generate_qr_data_uri(upi_link)

    pdf_bytes = generate_invoice_pdf(
        invoice_number=txn.invoice_number,
        business_name=owner.business_name if owner else "Business",
        business_phone=None,
        party_name=party.name,
        party_phone=party.phone,
        items=item_dicts,
        total=txn.amount,
        notes=txn.notes,
        upi_qr_data_uri=qr_data_uri,
    )
    return Response(content=pdf_bytes, media_type="application/pdf")
