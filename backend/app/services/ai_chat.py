"""
AI chat — four steps:

  1. CLASSIFY   — is this a ledger question? If not, refuse politely.
  2. CONTEXT    — fetch real party names + totals from DB to inject into prompts.
                  This stops the LLM hallucinating about parties that don't exist.
  3. GENERATE   — produce a SELECT query, retry once on failure with the error.
  4. SUMMARIZE  — answer in plain language, with full context so it can say
                  "Amul is not in your ledger" instead of just "₹0 found".
"""
import re
import json
from decimal import Decimal
from datetime import date

from groq import Groq
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

# ---------------------------------------------------------------------------
# Schema description — sent with every SQL generation request
# ---------------------------------------------------------------------------
SCHEMA = """
Database tables (PostgreSQL):

  parties(id, owner_id INTEGER, name TEXT, party_type TEXT,
          credit_period_days INTEGER, is_archived BOOLEAN)
      party_type = 'supplier' or 'customer'

  transactions(id, owner_id INTEGER, party_id INTEGER,
               transaction_type TEXT, amount NUMERIC,
               transaction_date DATE, notes TEXT)
      transaction_type values and their meaning:
        'bill'        — supplier sent a bill        → owner owes MORE
        'payment_out' — owner paid a supplier       → owner owes LESS
        'sale'        — customer bought on credit   → customer owes MORE
        'payment_in'  — customer paid the owner     → customer owes LESS

  Balance formula for any party:
    SUM(amount WHERE transaction_type IN ('bill','sale'))
    - SUM(amount WHERE transaction_type IN ('payment_out','payment_in'))
"""

# ---------------------------------------------------------------------------
# Multiple SQL examples — the more varied, the fewer LLM mistakes
# ---------------------------------------------------------------------------
SQL_EXAMPLES = """
-- Q: How much do I owe Amul?
SELECT COALESCE(
  SUM(CASE WHEN t.transaction_type IN ('bill') THEN t.amount
           WHEN t.transaction_type IN ('payment_out') THEN -t.amount
           ELSE 0 END), 0) AS balance_owed
FROM transactions t
JOIN parties p ON p.id = t.party_id
WHERE t.owner_id = :owner_id
  AND p.owner_id = :owner_id
  AND p.party_type = 'supplier'
  AND p.name ILIKE '%Amul%'

-- Q: Which customer owes me the most?
SELECT p.name,
  COALESCE(SUM(CASE WHEN t.transaction_type IN ('sale') THEN t.amount
                    WHEN t.transaction_type IN ('payment_in') THEN -t.amount
                    ELSE 0 END), 0) AS balance
FROM parties p
LEFT JOIN transactions t ON t.party_id = p.id AND t.owner_id = :owner_id
WHERE p.owner_id = :owner_id
  AND p.party_type = 'customer'
  AND p.is_archived = FALSE
GROUP BY p.id, p.name
HAVING COALESCE(SUM(CASE WHEN t.transaction_type IN ('sale') THEN t.amount
                          WHEN t.transaction_type IN ('payment_in') THEN -t.amount
                          ELSE 0 END), 0) > 0
ORDER BY balance DESC
LIMIT 5

-- Q: Show all unpaid bills
SELECT p.name, t.amount, t.transaction_date, t.notes
FROM transactions t
JOIN parties p ON p.id = t.party_id
WHERE t.owner_id = :owner_id
  AND p.owner_id = :owner_id
  AND t.transaction_type = 'bill'
ORDER BY t.transaction_date DESC
LIMIT 20

-- Q: Total receivable from customers
SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount
                         WHEN t.transaction_type = 'payment_in' THEN -t.amount
                         ELSE 0 END), 0) AS total_receivable
FROM transactions t
JOIN parties p ON p.id = t.party_id
WHERE t.owner_id = :owner_id
  AND p.owner_id = :owner_id
  AND p.party_type = 'customer'

-- Q: Show payments made this month
SELECT p.name, t.amount, t.transaction_date
FROM transactions t
JOIN parties p ON p.id = t.party_id
WHERE t.owner_id = :owner_id
  AND p.owner_id = :owner_id
  AND t.transaction_type IN ('payment_out', 'payment_in')
  AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY t.transaction_date DESC

-- Q: Show bills above 10000
SELECT p.name, t.amount, t.transaction_date, t.notes
FROM transactions t
JOIN parties p ON p.id = t.party_id
WHERE t.owner_id = :owner_id
  AND p.owner_id = :owner_id
  AND t.transaction_type = 'bill'
  AND t.amount > 10000
ORDER BY t.amount DESC

-- Q: List all suppliers with outstanding balance
SELECT p.name,
  SUM(CASE WHEN t.transaction_type IN ('bill') THEN t.amount
           WHEN t.transaction_type IN ('payment_out') THEN -t.amount
           ELSE 0 END) AS outstanding
FROM parties p
LEFT JOIN transactions t ON t.party_id = p.id AND t.owner_id = :owner_id
WHERE p.owner_id = :owner_id
  AND p.party_type = 'supplier'
  AND p.is_archived = FALSE
GROUP BY p.id, p.name
HAVING SUM(CASE WHEN t.transaction_type IN ('bill') THEN t.amount
                WHEN t.transaction_type IN ('payment_out') THEN -t.amount
                ELSE 0 END) > 0
ORDER BY outstanding DESC
"""

FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b",
    re.IGNORECASE,
)


def _client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


# ---------------------------------------------------------------------------
# Step 1 — classify
# ---------------------------------------------------------------------------
def _is_ledger_question(question: str) -> bool:
    client = _client()
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You decide if a question is about a small business's own "
                    "financial ledger: suppliers, customers, payments, dues, "
                    "invoices, balances, transactions, cash flow, or party names.\n"
                    "Reply with exactly YES or NO. Nothing else."
                ),
            },
            {"role": "user", "content": question},
        ],
        temperature=0,
        max_tokens=5,
    )
    return resp.choices[0].message.content.strip().upper().startswith("Y")


# ---------------------------------------------------------------------------
# Step 2 — fetch real context from DB
# ---------------------------------------------------------------------------
def _get_context(db: Session, owner_id: int) -> dict:
    """
    Pull real party names + summary totals from the DB.
    Injecting actual data into prompts stops the LLM guessing.
    """
    try:
        party_rows = db.execute(
            text("""
                SELECT p.name, p.party_type,
                  COALESCE(SUM(CASE WHEN t.transaction_type IN ('bill','sale') THEN t.amount
                                    WHEN t.transaction_type IN ('payment_out','payment_in') THEN -t.amount
                                    ELSE 0 END), 0) AS balance
                FROM parties p
                LEFT JOIN transactions t ON t.party_id = p.id AND t.owner_id = :owner_id
                WHERE p.owner_id = :owner_id AND p.is_archived = FALSE
                GROUP BY p.id, p.name, p.party_type
                ORDER BY ABS(SUM(COALESCE(CASE WHEN t.transaction_type IN ('bill','sale') THEN t.amount
                                               WHEN t.transaction_type IN ('payment_out','payment_in') THEN -t.amount
                                               ELSE 0 END, 0))) DESC
                LIMIT 30
            """),
            {"owner_id": owner_id}
        ).fetchall()

        parties = [{"name": r.name, "type": r.party_type, "balance": float(r.balance)} for r in party_rows]
        suppliers = [p for p in parties if p["type"] == "supplier"]
        customers = [p for p in parties if p["type"] == "customer"]

        txn_count = db.execute(
            text("SELECT COUNT(*) FROM transactions WHERE owner_id = :owner_id"),
            {"owner_id": owner_id}
        ).scalar()

        return {
            "parties": parties,
            "suppliers": suppliers,
            "customers": customers,
            "total_parties": len(parties),
            "total_transactions": int(txn_count or 0),
            "today": date.today().isoformat(),
        }
    except Exception:
        return {"parties": [], "suppliers": [], "customers": [], "total_transactions": 0, "today": date.today().isoformat()}


# ---------------------------------------------------------------------------
# Step 3 — generate SQL (with one retry on failure)
# ---------------------------------------------------------------------------
def _build_sql_prompt(context: dict) -> str:
    party_hint = ""
    if context["parties"]:
        names = ", ".join(f'"{p["name"]}"' for p in context["parties"][:15])
        party_hint = f"\nActual parties in this ledger: {names}\n"

    return f"""You write a single PostgreSQL SELECT query for a business ledger.

{SCHEMA}
{party_hint}
RULES (violating any makes the query fail):
1. Output ONLY raw SQL. No explanation, no markdown, no code fences.
2. Must start with SELECT.
3. Every table reference needs "owner_id = :owner_id" in WHERE — use literal :owner_id placeholder.
4. Use ILIKE '%name%' for fuzzy party name matching.
5. Use COALESCE(..., 0) to avoid NULLs.
6. Use CASE WHEN for balance calculations, not a simple SUM.
7. No semicolons, no write operations (INSERT/UPDATE/DELETE/DROP etc).
8. For "this month" use DATE_TRUNC('month', CURRENT_DATE).
9. For "this week" use CURRENT_DATE - INTERVAL '7 days'.
10. Always LIMIT results to 20 rows maximum for list queries.

EXAMPLES:
{SQL_EXAMPLES}
"""


def _generate_sql(question: str, context: dict, previous_error: str = None) -> str:
    client = _client()
    messages = [{"role": "system", "content": _build_sql_prompt(context)}]

    if previous_error:
        messages.append({"role": "user", "content": question})
        messages.append({"role": "assistant", "content": previous_error})
        messages.append({
            "role": "user",
            "content": f"That query failed with: {previous_error}\nPlease fix it and return only the corrected SQL."
        })
    else:
        messages.append({"role": "user", "content": question})

    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        temperature=0,
        max_tokens=600,
    )
    sql = resp.choices[0].message.content.strip()
    sql = re.sub(r"^```[\w]*\n?|```$", "", sql, flags=re.MULTILINE).strip()
    return sql


def _validate_sql(sql: str) -> None:
    if not sql.lower().lstrip().startswith("select"):
        raise ValueError("Not a SELECT statement.")
    if FORBIDDEN.search(sql):
        raise ValueError("Contains a forbidden write operation.")
    if ":owner_id" not in sql:
        raise ValueError("Missing :owner_id scope filter.")
    clean = sql.strip().rstrip(";")
    if ";" in clean:
        raise ValueError("Contains multiple statements.")


# ---------------------------------------------------------------------------
# Step 4 — summarize with full context
# ---------------------------------------------------------------------------
def _row_to_jsonable(row) -> dict:
    out = {}
    for k, v in row._mapping.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def _summarize(question: str, rows: list, context: dict) -> str:
    client = _client()

    party_names = [p["name"] for p in context.get("parties", [])]
    has_data = context.get("total_transactions", 0) > 0

    system_prompt = f"""You are a helpful assistant for a small Indian business owner reading their ledger.

Known parties in their ledger: {', '.join(party_names) if party_names else 'none yet'}
Total transactions logged: {context.get('total_transactions', 0)}
Today's date: {context.get('today', '')}

Given the owner's question and the raw SQL query results, answer clearly in 1-3 sentences.
Use ₹ for amounts. Format large numbers Indian style (₹1,20,000 not ₹120,000).

If results are empty or zero:
- Check if the party name they asked about is in the known parties list above
- If NOT in the list: say "I don't see [name] in your ledger — check if they're added or spelled differently"
- If IN the list but zero balance: say "[name] has no outstanding balance — all settled"
- If no transactions at all: say "No transactions logged yet for this"

Never say "based on the data" or "according to results" — just answer directly like a knowledgeable assistant."""

    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}\n\nResults: {json.dumps(rows)}"},
        ],
        temperature=0.1,
        max_tokens=350,
    )
    return resp.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
class NotLedgerQuestion(Exception):
    pass


def answer_question(db: Session, owner_id: int, question: str) -> dict:
    # Step 1: classify
    if not _is_ledger_question(question):
        raise NotLedgerQuestion(
            "I can only answer questions about your ledger — suppliers, customers, "
            "payments, and dues. Try: 'How much do I owe Amul?' or 'Which customer owes me the most?'"
        )

    # Step 2: fetch real context
    context = _get_context(db, owner_id)

    # Step 3: generate SQL with one retry on failure
    sql = _generate_sql(question, context)
    try:
        _validate_sql(sql)
        result = db.execute(text(sql), {"owner_id": owner_id})
        rows = [_row_to_jsonable(r) for r in result.fetchall()]
    except Exception as e:
        # Retry once with the error message
        try:
            sql = _generate_sql(question, context, previous_error=str(e))
            _validate_sql(sql)
            result = db.execute(text(sql), {"owner_id": owner_id})
            rows = [_row_to_jsonable(r) for r in result.fetchall()]
        except Exception as e2:
            # Both attempts failed — answer from context alone
            return {
                "answer": _summarize_from_context(question, context),
                "generated_sql": None,
            }

    # Step 4: summarize
    answer = _summarize(question, rows, context)
    return {"answer": answer, "generated_sql": sql}


def _summarize_from_context(question: str, context: dict) -> str:
    """Fallback: answer using only the fetched context, no SQL needed."""
    client = _client()
    party_list = json.dumps(context.get("parties", []))
    resp = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant for a small Indian business owner. "
                    "Answer their ledger question using only the party data provided. "
                    "Use ₹ for amounts. Be honest if data is insufficient."
                ),
            },
            {
                "role": "user",
                "content": f"Question: {question}\n\nLedger parties and balances: {party_list}",
            },
        ],
        temperature=0.1,
        max_tokens=300,
    )
    return resp.choices[0].message.content.strip()
