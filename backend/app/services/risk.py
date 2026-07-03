"""
AI Risk Scoring for each party.
Computed from transaction history — no ML, pure business logic + LLM reasoning.

Score 0-100: 0 = perfect, 100 = critical risk
Label: LOW (<30), MEDIUM (30-60), HIGH (>60)
"""
import json
from datetime import date
from decimal import Decimal

from groq import Groq
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Transaction, Party, TransactionType
from app.services.ledger import party_balance


def _client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


def _get_party_stats(db: Session, party: Party) -> dict:
    txns = (
        db.query(Transaction)
        .filter(Transaction.party_id == party.id)
        .order_by(Transaction.transaction_date)
        .all()
    )

    if not txns:
        return None

    balance = float(party_balance(db, party.id))

    bills = [t for t in txns if t.transaction_type in (TransactionType.bill, TransactionType.sale)]
    payments = [t for t in txns if t.transaction_type in (TransactionType.payment_out, TransactionType.payment_in)]

    # Days since last payment
    days_since_payment = None
    if payments:
        last_pay = max(p.transaction_date for p in payments)
        days_since_payment = (date.today() - last_pay).days

    # Days since last bill
    days_since_bill = None
    if bills:
        last_bill = max(b.transaction_date for b in bills)
        days_since_bill = (date.today() - last_bill).days

    # Average payment delay (rough)
    avg_delay = None
    if bills and payments:
        avg_delay = abs(days_since_payment - days_since_bill) if days_since_payment and days_since_bill else None

    # Balance trend: is outstanding growing?
    mid = len(bills) // 2
    early_balance = sum(float(b.amount) for b in bills[:mid])
    late_balance = sum(float(b.amount) for b in bills[mid:])
    balance_growing = late_balance > early_balance if mid > 0 else False

    return {
        "party_name": party.name,
        "party_type": party.party_type.value,
        "current_balance": balance,
        "credit_period_days": party.credit_period_days,
        "total_transactions": len(txns),
        "days_since_last_payment": days_since_payment,
        "days_since_last_bill": days_since_bill,
        "average_delay_days": avg_delay,
        "balance_growing": balance_growing,
        "num_bills": len(bills),
        "num_payments": len(payments),
    }


def compute_risk(db: Session, party: Party) -> dict:
    stats = _get_party_stats(db, party)

    if not stats or stats["current_balance"] <= 0:
        return {
            "risk_score": 0.0,
            "risk_label": "LOW",
            "risk_reasons": ["No outstanding balance"]
        }

    client = _client()
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You assess payment risk for a small Indian business's supplier or customer. "
                    "Return ONLY a JSON object: "
                    '{"score": 0-100, "label": "LOW"|"MEDIUM"|"HIGH", "reasons": ["reason1", "reason2"]} '
                    "Score 0=no risk, 100=critical. Max 3 short reasons. No markdown."
                )
            },
            {"role": "user", "content": json.dumps(stats)}
        ],
        temperature=0,
        max_tokens=200,
    )

    import re
    raw = resp.choices[0].message.content.strip()
    raw = re.sub(r"^```[\w]*\n?|```$", "", raw, flags=re.MULTILINE).strip()
    result = json.loads(raw)

    return {
        "risk_score": float(result.get("score", 0)),
        "risk_label": result.get("label", "LOW"),
        "risk_reasons": result.get("reasons", []),
    }
