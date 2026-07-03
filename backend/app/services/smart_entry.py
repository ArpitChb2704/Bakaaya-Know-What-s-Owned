"""
Smart Entry — converts natural language (English, Hindi, Hinglish) into a
structured transaction record.

Examples:
  "amul bill 15000"               → supplier bill ₹15,000 from Amul
  "sharma paid 8000 today"        → customer payment_in ₹8,000 from Sharma
  "paid pepsi 12000 upi"          → payment_out ₹12,000 to Pepsi
  "amul ka bill 15000"            → same as first
  "sharma ko 8000 de diye"        → payment_out ₹8,000 to Sharma
  "coca cola se maal liya 25000"  → supplier bill ₹25,000 from Coca Cola
"""
import json
import re
from datetime import date
from decimal import Decimal

from groq import Groq
from app.config import settings


def _client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


SYSTEM_PROMPT = """You parse short transaction entries from a small Indian business owner.
Input can be English, Hindi, or Hinglish.

You must return ONLY a valid JSON object with these exact fields:
{
  "party_name": "string - the supplier or customer name",
  "party_type": "supplier" or "customer",
  "transaction_type": "bill" | "payment_out" | "sale" | "payment_in",
  "amount": number,
  "transaction_date": "YYYY-MM-DD",
  "notes": "string or null",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

Transaction type rules:
- bill: owner RECEIVED a bill/invoice from a supplier (they now owe more)
- payment_out: owner PAID a supplier (they owe less)
- sale: owner gave goods/credit to a customer (customer owes more)
- payment_in: owner RECEIVED payment from a customer (customer owes less)

Party type rules:
- supplier: someone the owner BUYS from (Amul, Pepsi, Britannia etc)
- customer: someone who BUYS from the owner (shops, hotels, cafes)

Hindi/Hinglish keywords:
- "bill", "maal liya", "kharida", "aaya" → supplier bill
- "de diye", "diya", "pay kiya", "bheja" → payment_out to supplier
- "becha", "diya customer ko", "udhar diya" → sale to customer
- "mila", "aaya payment", "received" → payment_in from customer
- "ka bill" → bill from that party (supplier)
- "ko diya/de diye" → payment to that party (supplier)
- "ne diya/pay kiya" → payment from that party (customer)

Today's date: DATE_TODAY

If confidence is LOW (ambiguous), still return your best guess.
Return ONLY the JSON. No explanation, no markdown.
"""


def parse_entry(text: str) -> dict:
    client = _client()
    prompt = SYSTEM_PROMPT.replace("DATE_TODAY", date.today().isoformat())

    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text.strip()},
        ],
        temperature=0,
        max_tokens=300,
    )

    raw = resp.choices[0].message.content.strip()
    # strip markdown fences if present
    raw = re.sub(r"^```[\w]*\n?|```$", "", raw, flags=re.MULTILINE).strip()

    parsed = json.loads(raw)

    # Normalise amount
    parsed["amount"] = Decimal(str(parsed["amount"]))

    # Validate required fields
    required = ["party_name", "party_type", "transaction_type", "amount", "transaction_date"]
    for f in required:
        if f not in parsed:
            raise ValueError(f"Missing field: {f}")

    return parsed
