"""
Cashflow Forecasting — pure pattern math, no ML.
Looks at last 90 days of transactions, computes weekly averages,
projects forward 4 weeks with gap analysis.
"""
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import Transaction, TransactionType


def _week_key(d: date) -> date:
    return d - timedelta(days=d.weekday())


def forecast(db: Session, owner_id: int) -> dict:
    cutoff = date.today() - timedelta(days=90)
    txns = db.query(Transaction).filter(
        Transaction.owner_id == owner_id,
        Transaction.transaction_date >= cutoff,
    ).all()

    weekly_in = defaultdict(Decimal)
    weekly_out = defaultdict(Decimal)

    for t in txns:
        wk = _week_key(t.transaction_date)
        if t.transaction_type in (TransactionType.payment_in, TransactionType.sale):
            weekly_in[wk] += Decimal(str(t.amount))
        else:
            weekly_out[wk] += Decimal(str(t.amount))

    if not weekly_in and not weekly_out:
        return {
            "weeks": [],
            "summary": "Not enough transaction history to forecast. Log at least a few weeks of transactions first.",
            "warning": None,
        }

    weeks_with_data = len(set(list(weekly_in.keys()) + list(weekly_out.keys()))) or 1
    avg_in = sum(weekly_in.values(), Decimal("0")) / weeks_with_data
    avg_out = sum(weekly_out.values(), Decimal("0")) / weeks_with_data

    # Build 4-week forecast
    forecast_weeks = []
    today = date.today()
    total_gap = Decimal("0")

    for i in range(4):
        week_start = today + timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)

        # Add some variance: later weeks have more uncertainty
        uncertainty = Decimal(str(1 - i * 0.05))
        exp_in = (avg_in * uncertainty).quantize(Decimal("1"))
        exp_out = (avg_out * uncertainty).quantize(Decimal("1"))
        net = exp_in - exp_out
        gap = net if net < 0 else None
        if gap:
            total_gap += gap

        forecast_weeks.append({
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "expected_inflow": float(exp_in),
            "expected_outflow": float(exp_out),
            "net": float(net),
            "gap": float(gap) if gap else None,
        })

    # Build plain-language summary
    total_in = sum(w["expected_inflow"] for w in forecast_weeks)
    total_out = sum(w["expected_outflow"] for w in forecast_weeks)
    net_4w = total_in - total_out

    summary = (
        f"Over the next 4 weeks, you're expected to collect ₹{int(total_in):,} "
        f"and pay out ₹{int(total_out):,}, "
        f"giving a net {'surplus' if net_4w >= 0 else 'shortfall'} of ₹{abs(int(net_4w)):,}."
    )

    warning = None
    if total_gap < 0:
        warning = f"Cash shortfall of ₹{abs(int(total_gap)):,} expected in the next 4 weeks. Consider following up on overdue receivables."

    return {"weeks": forecast_weeks, "summary": summary, "warning": warning}
