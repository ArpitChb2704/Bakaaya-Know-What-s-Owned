"""
Bank Statement Import Service
Parses CSV bank statements and uses AI to match rows to known parties.
Supports common Indian bank CSV formats (SBI, HDFC, ICICI, Axis, Kotak).
"""
import io
import csv
import json
import re
from datetime import date
from decimal import Decimal
from typing import List, Optional

from groq import Groq
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Party


DATE_PATTERNS = [
    r'\d{2}/\d{2}/\d{4}', r'\d{2}-\d{2}-\d{4}',
    r'\d{4}-\d{2}-\d{2}', r'\d{2} \w{3} \d{4}',
]

AMOUNT_COLS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'dr', 'cr', 'txn amount', 'transaction amount']
DATE_COLS = ['date', 'transaction date', 'txn date', 'value date']
DESC_COLS = ['description', 'narration', 'particulars', 'remarks', 'details']


def _parse_amount(val: str) -> Optional[Decimal]:
    if not val or val.strip() in ('', '-', 'None', 'null'):
        return None
    cleaned = re.sub(r'[₹,\s]', '', str(val))
    try:
        return Decimal(cleaned)
    except Exception:
        return None


def _parse_date(val: str) -> Optional[date]:
    if not val or not val.strip():
        return None
    val = val.strip()
    formats = ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d %b %Y', '%d-%b-%Y', '%d/%b/%Y', '%m/%d/%Y']
    from datetime import datetime
    for fmt in formats:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


def _find_col(headers: List[str], candidates: List[str]) -> Optional[str]:
    for h in headers:
        if h.lower().strip() in candidates:
            return h
    return None


def parse_csv(content: bytes) -> List[dict]:
    """Parse bank CSV and return normalized rows."""
    text = content.decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    date_col = _find_col(headers, DATE_COLS)
    desc_col = _find_col(headers, DESC_COLS)

    # Detect debit/credit split or single amount col
    debit_col = _find_col(headers, ['debit', 'withdrawal', 'dr', 'withdrawal amt', 'debit amount'])
    credit_col = _find_col(headers, ['credit', 'deposit', 'cr', 'deposit amt', 'credit amount'])
    amount_col = _find_col(headers, ['amount', 'txn amount', 'transaction amount']) if not (debit_col or credit_col) else None

    rows = []
    for row in reader:
        if not date_col or not desc_col:
            continue
        d = _parse_date(row.get(date_col, ''))
        desc = row.get(desc_col, '').strip()
        if not d or not desc:
            continue

        amount = None
        txn_type = None

        if debit_col and credit_col:
            debit = _parse_amount(row.get(debit_col, ''))
            credit = _parse_amount(row.get(credit_col, ''))
            if debit and debit > 0:
                amount = debit
                txn_type = 'debit'
            elif credit and credit > 0:
                amount = credit
                txn_type = 'credit'
        elif amount_col:
            amount = _parse_amount(row.get(amount_col, ''))
            # Try to find a Dr/Cr indicator column
            indicator_col = _find_col(headers, ['type', 'dr/cr', 'cr/dr', 'debit/credit', 'txn type'])
            if indicator_col:
                ind = row.get(indicator_col, '').strip().upper()
                txn_type = 'debit' if 'D' in ind else 'credit' if 'C' in ind else None

        if amount and amount > 0:
            rows.append({
                'date': d.isoformat(),
                'description': desc,
                'amount': float(amount),
                'transaction_type': txn_type or 'unknown',
                'reference': row.get('reference', row.get('ref no', row.get('chq no', ''))),
            })

    return rows


def match_with_ai(rows: List[dict], parties: List[Party]) -> List[dict]:
    """Use AI to match bank rows to known parties."""
    if not rows:
        return []

    party_list = [{"id": p.id, "name": p.name, "type": p.party_type.value} for p in parties]
    client = Groq(api_key=settings.groq_api_key)

    # Process in batches of 10
    results = []
    for i in range(0, len(rows), 10):
        batch = rows[i:i+10]
        prompt = f"""Match these bank transactions to known business parties.

Known parties: {json.dumps(party_list)}

Bank transactions: {json.dumps(batch)}

For each transaction, return a JSON array where each item has:
{{
  "index": 0,
  "matched_party_id": <id or null>,
  "matched_party_name": "<name or null>",
  "suggested_transaction_type": "<bill|payment_out|sale|payment_in|null>",
  "confidence": "<HIGH|MEDIUM|LOW|NONE>"
}}

Rules:
- Match by name similarity in description (e.g. "AMUL DAIRY" matches party "Amul")
- If bank row is DEBIT (money going out) and party is supplier → payment_out
- If bank row is CREDIT (money coming in) and party is customer → payment_in
- If no party matches, set matched_party_id to null and confidence to NONE
- Return ONLY the JSON array, no markdown."""

        try:
            resp = client.chat.completions.create(
                model=settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0, max_tokens=800,
            )
            raw = resp.choices[0].message.content.strip()
            raw = re.sub(r'^```[\w]*\n?|```$', '', raw, flags=re.MULTILINE).strip()
            matches = json.loads(raw)
            for j, match in enumerate(matches):
                if i + j < len(rows):
                    results.append({**batch[j], **match})
        except Exception:
            for row in batch:
                results.append({**row, "matched_party_id": None, "matched_party_name": None,
                                 "suggested_transaction_type": None, "confidence": "NONE"})

    return results
