from decimal import Decimal
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.auth import get_current_user
from app.database import get_db
from app.models import Party, User, PartyType, Transaction, TransactionType
from app.schemas import DashboardSummary, CalendarEvent
from app.services.ledger import party_balance, is_overdue

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    parties = db.query(Party).filter(
        Party.owner_id == current_user.id, Party.is_archived == False
    ).all()

    total_receivable = Decimal("0")
    total_payable = Decimal("0")
    overdue_count = 0
    overdue_amount = Decimal("0")
    high_risk_count = 0

    for p in parties:
        balance = party_balance(db, p.id)
        if balance <= 0:
            continue
        if p.party_type == PartyType.customer:
            total_receivable += balance
        else:
            total_payable += balance
        if is_overdue(db, p):
            overdue_count += 1
            overdue_amount += balance
        if p.risk_label == "HIGH":
            high_risk_count += 1

    # Upcoming dues this week
    next_week = date.today() + timedelta(days=7)
    upcoming = db.query(Transaction).filter(
        Transaction.owner_id == current_user.id,
        Transaction.due_date != None,
        Transaction.due_date <= next_week,
        Transaction.due_date >= date.today(),
    ).all()
    upcoming_week_amount = sum(Decimal(str(t.amount)) for t in upcoming)

    return DashboardSummary(
        total_receivable=total_receivable,
        total_payable=total_payable,
        overdue_count=overdue_count,
        overdue_amount=overdue_amount,
        high_risk_count=high_risk_count,
        upcoming_week_amount=upcoming_week_amount,
    )


@router.get("/calendar", response_model=List[CalendarEvent])
def get_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    parties = db.query(Party).filter(
        Party.owner_id == current_user.id, Party.is_archived == False
    ).all()

    events = []
    today = date.today()
    window_end = today + timedelta(days=30)

    for p in parties:
        balance = party_balance(db, p.id)
        if balance <= 0:
            continue

        # Overdue — flag today
        if is_overdue(db, p):
            events.append(CalendarEvent(
                date=today,
                party_name=p.name,
                party_id=p.id,
                party_type=p.party_type,
                event_type="overdue",
                amount=balance,
            ))
            continue

        # Find oldest unpaid bill to compute expected due date
        from sqlalchemy import func
        oldest = (
            db.query(func.min(Transaction.transaction_date))
            .filter(
                Transaction.party_id == p.id,
                Transaction.transaction_type.in_([TransactionType.bill, TransactionType.sale]),
            )
            .scalar()
        )
        if oldest:
            due = oldest + timedelta(days=p.credit_period_days)
            if today <= due <= window_end:
                events.append(CalendarEvent(
                    date=due,
                    party_name=p.name,
                    party_id=p.id,
                    party_type=p.party_type,
                    event_type="due",
                    amount=balance,
                ))

    events.sort(key=lambda e: e.date)
    return events
