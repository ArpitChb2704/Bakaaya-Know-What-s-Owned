"""
Ledger arithmetic, in one place, so the dashboard, the party list, and the
AI chat layer all agree on what "balance" and "overdue" mean.

Convention (matches a physical khata):
  - For a SUPPLIER: bill increases what you owe them; payment_out decreases it.
    balance > 0 means YOU owe THEM (payable).
  - For a CUSTOMER: sale increases what they owe you; payment_in decreases it.
    balance > 0 means THEY owe YOU (receivable).
"""
from decimal import Decimal
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Transaction, Party, TransactionType, PartyType


def party_balance(db: Session, party_id: int) -> Decimal:
    increases = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.party_id == party_id,
            Transaction.transaction_type.in_([TransactionType.bill, TransactionType.sale]),
        )
        .scalar()
    )
    decreases = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.party_id == party_id,
            Transaction.transaction_type.in_(
                [TransactionType.payment_out, TransactionType.payment_in]
            ),
        )
        .scalar()
    )
    return Decimal(increases) - Decimal(decreases)


def is_overdue(db: Session, party: Party) -> bool:
    """A party is overdue if it has a positive balance and the oldest unpaid
    bill/sale is older than its credit period."""
    balance = party_balance(db, party.id)
    if balance <= 0:
        return False

    oldest_unpaid = (
        db.query(func.min(Transaction.transaction_date))
        .filter(
            Transaction.party_id == party.id,
            Transaction.transaction_type.in_([TransactionType.bill, TransactionType.sale]),
        )
        .scalar()
    )
    if not oldest_unpaid:
        return False

    days_outstanding = (date.today() - oldest_unpaid).days
    return days_outstanding > (party.credit_period_days or 7)
