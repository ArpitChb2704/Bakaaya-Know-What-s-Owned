"""
Supplier Performance Scoring
Derived purely from existing transaction data — no new data needed.
"""
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session
from app.models import Party, Transaction, TransactionType, PartyType
from app.services.ledger import party_balance


def score_supplier(db: Session, party: Party) -> dict:
    if party.party_type != PartyType.supplier:
        return None

    txns = db.query(Transaction).filter(Transaction.party_id == party.id).all()
    if not txns:
        return {"party_id": party.id, "party_name": party.name,
                "avg_payment_days": None, "total_billed": Decimal("0"),
                "total_paid": Decimal("0"), "payment_ratio": 0.0,
                "outstanding": Decimal("0"), "score": 50.0, "grade": "B",
                "insight": "No transactions yet — can't score this supplier."}

    bills = [t for t in txns if t.transaction_type == TransactionType.bill]
    payments = [t for t in txns if t.transaction_type == TransactionType.payment_out]

    total_billed = sum(Decimal(str(t.amount)) for t in bills)
    total_paid = sum(Decimal(str(t.amount)) for t in payments)
    outstanding = party_balance(db, party.id)

    payment_ratio = float(total_paid / total_billed) if total_billed > 0 else 0.0

    # Average days between bill and payment
    avg_days = None
    if bills and payments:
        bill_dates = sorted(t.transaction_date for t in bills)
        pay_dates = sorted(t.transaction_date for t in payments)
        delays = []
        for bd in bill_dates:
            later_pays = [p for p in pay_dates if p >= bd]
            if later_pays:
                delays.append((later_pays[0] - bd).days)
        avg_days = sum(delays) / len(delays) if delays else None

    # Score: higher is better supplier relationship
    score = 100.0
    if avg_days is not None:
        if avg_days > 30: score -= 30
        elif avg_days > 14: score -= 15
        elif avg_days > 7: score -= 5

    if payment_ratio < 0.5: score -= 30
    elif payment_ratio < 0.8: score -= 15
    elif payment_ratio < 1.0: score -= 5

    if float(outstanding) > 50000: score -= 20
    elif float(outstanding) > 20000: score -= 10

    score = max(0.0, min(100.0, score))

    if score >= 80: grade, insight = "A", "Excellent payment track record. Keep it up."
    elif score >= 60: grade, insight = "B", "Good relationship. Minor delays noted."
    elif score >= 40: grade, insight = "C", "Moderate delays. Consider paying more regularly."
    else: grade, insight = "D", "Poor track record. High outstanding and frequent delays."

    return {
        "party_id": party.id,
        "party_name": party.name,
        "avg_payment_days": round(avg_days, 1) if avg_days else None,
        "total_billed": total_billed,
        "total_paid": total_paid,
        "payment_ratio": round(payment_ratio, 2),
        "outstanding": outstanding,
        "score": round(score, 1),
        "grade": grade,
        "insight": insight,
    }
