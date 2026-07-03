# Bakaaya

**Know what's owed. Ask, don't search.**

Bakaaya is a full-stack AI-powered supplier and customer ledger built for small Indian businesses. Instead of hunting through spreadsheets, you type *"How much do I owe Amul?"* and get an instant answer. Instead of filling forms, you type *"amul ka bill 15000"* and it's logged.

---

## What it does

### Core ledger
- Add suppliers and customers (with GST number, phone, credit period)
- Log bills, sales, payments in any direction
- Dashboard showing total receivable, payable, overdue amount, net position

### Smart entry (flagship)
Type naturally at the top of the dashboard — English, Hindi, or Hinglish:
```
Amul bill 15000
Paid Pepsi 12000 by UPI
sharma ko 8000 de diye
coca cola se maal liya 25000
```
AI parses it into a structured transaction, shows a preview card, you confirm in one click. New parties are auto-created if they don't exist yet.

### Ask AI
Ask plain questions about your ledger in any language:
- *"How much do I owe Amul?"*
- *"Which customer owes me the most?"*
- *"Show bills above ₹10,000"*
- *"Payments made this month?"*

AI converts your question to a SQL query, runs it against your data, and answers in plain language. Your data never leaves your database.

### Bank statement import
1. Download your bank statement CSV (every Indian bank supports this)
2. Upload it to Bakaaya
3. AI auto-matches rows to your known suppliers and customers
4. Review matches, deselect any you don't want, confirm in one click

Supports SBI, HDFC, ICICI, Axis, Kotak and most Indian bank CSV formats.

### Duplicate detection
When logging a transaction, Bakaaya checks if a similar entry (same party, same amount, within 3 days) already exists and warns you before saving. Catches double-entry before it corrupts the ledger.

### Party detail — timeline ledger
Click any supplier or customer to see their full transaction history with a running balance column — exactly like a handwritten khata page, with every entry and the balance after each one.

### Statement / PDF
Generate a professional printable account statement for any supplier or customer — one click to open, print, or save as PDF. Share on WhatsApp with suppliers who ask for their outstanding history.

### UPI payment link
For any customer with an outstanding balance, generate a UPI deeplink + a ready-to-send WhatsApp message. Customer taps the link, pays, you log the payment. Closes the collection loop without any back and forth.

### Payment calendar
Monthly calendar view showing every upcoming due date and overdue party. Click a day to see who owes what. Overdue shown in red, due soon in yellow.

### AI risk scoring
For each supplier or customer, compute a risk score (0–100) based on payment history, days outstanding, and whether the balance is growing. LOW / MEDIUM / HIGH label with specific reasons.

### Reminder CRM
Log every follow-up against a party — called, visited, email sent, payment promised, paid. Set a follow-up date. Full history per party. Turns chasing payments into a trackable process.

### Cashflow forecast
Based on the last 90 days of transactions, projects 4 weeks forward:
- Expected weekly inflow and outflow
- Net position per week
- Cash gap warnings where outflow exceeds inflow

No ML — pure pattern math on your own data.

### Supplier performance scores
Each supplier gets an A/B/C/D grade derived from:
- Average days to pay their bills
- Payment ratio (paid vs billed)
- Outstanding balance
- Whether the balance is growing

No new data needed — computed entirely from transactions already in your ledger.

### Team access (RBAC)
Owner can invite an accountant or manager with a one-time token. Each role has different permissions:

| Permission | Accountant | Manager | Owner |
|---|:---:|:---:|:---:|
| View all data | ✓ | ✓ | ✓ |
| Log transactions | ✓ | ✓ | ✓ |
| Add parties | ✓ | ✓ | ✓ |
| Approve payments under ₹10,000 | — | ✓ | ✓ |
| Approve payments above ₹10,000 | — | — | ✓ |
| Invite team / delete data | — | — | ✓ |

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLAlchemy + PostgreSQL |
| AI | Groq (Llama 3.1 8B) — free tier |
| Frontend | React + Vite + Tailwind CSS |
| Auth | JWT + RBAC |
| Deploy (backend) | Railway free tier |
| Deploy (frontend) | Vercel free tier |
| Database | Railway Postgres or Supabase (both free) |

---

## Project structure

```
bakaaya/
├── README.md
├── docker-compose.yml          # Local Postgres
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py             # FastAPI app + all routers
│       ├── config.py           # Settings from env vars
│       ├── database.py         # SQLAlchemy engine + session
│       ├── models.py           # DB tables (users, parties, transactions, etc.)
│       ├── schemas.py          # Pydantic request/response models
│       ├── auth.py             # JWT + RBAC helpers
│       ├── routers/
│       │   ├── auth.py         # Signup, login, team invite/accept
│       │   ├── parties.py      # CRUD suppliers + customers, risk endpoint
│       │   ├── transactions.py # Log, edit, delete, duplicate check, approve
│       │   ├── dashboard.py    # Summary totals + calendar events
│       │   ├── chat.py         # AI question answering
│       │   ├── reminders.py    # Follow-up CRM per party
│       │   ├── smart_entry.py  # Natural language transaction parsing
│       │   ├── bank_import.py  # CSV upload + AI matching + confirm
│       │   └── analytics.py    # Cashflow, scores, statement, UPI link
│       └── services/
│           ├── ledger.py       # Balance + overdue calculation
│           ├── ai_chat.py      # Text-to-SQL pipeline (Groq)
│           ├── smart_entry.py  # NLP transaction parser (Groq)
│           ├── risk.py         # AI risk scoring per party
│           ├── bank_import.py  # CSV parsing + AI party matching
│           ├── cashflow.py     # 4-week forecast from transaction history
│           ├── supplier_score.py # A/B/C/D supplier performance grades
│           └── statement_pdf.py  # HTML statement generator
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx             # Router + auth guard + all routes
        ├── index.css
        ├── lib/
        │   ├── api.js          # All API calls
        │   ├── format.js       # ₹ formatting, date formatting
        │   └── AuthContext.jsx # Auth state + role
        └── components/
            ├── AuthPage.jsx    # Login, signup, team invite accept
            ├── Nav.jsx         # Top navigation (all 9 pages)
            ├── SmartEntry.jsx  # Natural language entry bar
            ├── Wordmark.jsx    # Brand mark
            └── pages/
                ├── Overview.jsx      # Dashboard home + smart entry
                ├── PartyList.jsx     # Suppliers or customers table
                ├── PartyDetail.jsx   # Timeline ledger + reminders + UPI + statement
                ├── Transactions.jsx  # Full transaction log + edit + duplicate warning
                ├── CalendarView.jsx  # Monthly payment calendar
                ├── AskPage.jsx       # AI chat interface
                ├── BankImport.jsx    # CSV upload → match → confirm flow
                ├── Analytics.jsx     # Cashflow forecast + supplier scores
                └── Team.jsx          # Invite + manage team members
```

---

## API routes (28 total)

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/team/invite
POST   /api/auth/team/accept
GET    /api/auth/team
DELETE /api/auth/team/{id}

GET    /api/parties
POST   /api/parties
GET    /api/parties/{id}
PATCH  /api/parties/{id}
DELETE /api/parties/{id}
POST   /api/parties/{id}/risk

GET    /api/transactions
POST   /api/transactions
POST   /api/transactions/check-duplicate
PATCH  /api/transactions/{id}
DELETE /api/transactions/{id}
POST   /api/transactions/{id}/approve

GET    /api/dashboard/summary
GET    /api/dashboard/calendar

POST   /api/chat
POST   /api/smart-entry/parse
POST   /api/smart-entry/confirm

GET    /api/reminders
POST   /api/reminders
PATCH  /api/reminders/{id}
DELETE /api/reminders/{id}

POST   /api/bank-import/upload
POST   /api/bank-import/confirm

GET    /api/analytics/cashflow
GET    /api/analytics/supplier-scores
POST   /api/analytics/statement
POST   /api/analytics/upi-link
```

---

## Run locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (for local Postgres)
- Free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Start Postgres
```bash
docker compose up db -d
```

### 2. Backend
```bash
cd backend

cp .env.example .env
# Edit .env:
#   SECRET_KEY = python3 -c "import secrets; print(secrets.token_hex(32))"
#   GROQ_API_KEY = your key from console.groq.com

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger docs at `http://localhost:8000/docs`

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000  (already set)

npm install
npm run dev
```

Open `http://localhost:5173` → sign up → done.

---

## Deploy free

### Backend → Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set root directory to `backend`
3. Add a **Postgres** plugin from the Railway dashboard
4. Set environment variables:
   ```
   DATABASE_URL   = (copy from Railway Postgres plugin → Internal URL)
   SECRET_KEY     = (generate: python3 -c "import secrets; print(secrets.token_hex(32))")
   GROQ_API_KEY   = (from console.groq.com)
   CORS_ORIGINS   = https://your-app.vercel.app
   ```
5. Deploy. Railway gives you a URL like `https://bakaaya-backend.up.railway.app`

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Root directory: `frontend`
3. Framework preset: **Vite**
4. Environment variable:
   ```
   VITE_API_URL = https://your-backend.up.railway.app
   ```
5. Deploy. Done.

---

## Existing DB migration

If upgrading from v1 or v2, run these SQL commands on your existing database:

```sql
-- Team access (v3)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'owner';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Transaction approval flow (v3)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved BOOLEAN;

-- GST number on parties (v2)
ALTER TABLE parties ADD COLUMN IF NOT EXISTS gst_number VARCHAR;

-- Risk scoring on parties (v2)
ALTER TABLE parties ADD COLUMN IF NOT EXISTS risk_score FLOAT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS risk_label VARCHAR;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS risk_reasons TEXT;

-- New tables (run if not exists)
CREATE TABLE IF NOT EXISTS team_invites (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id),
    email VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'accountant',
    token VARCHAR UNIQUE NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

Fresh installs get all of this automatically on first startup — no migration needed.

---

## How the AI works

### Smart entry (natural language → transaction)
1. Owner types: *"amul ka bill 15000"*
2. Groq (Llama 3.1 8B) parses it against known Hindi/English/Hinglish patterns
3. Returns structured JSON: party, type, amount, date
4. Preview shown to user — one click to confirm or edit
5. If party doesn't exist, created automatically

### AI chat (question → SQL → answer)
1. Owner asks: *"How much do I owe Amul?"*
2. LLM writes a `SELECT` query scoped to `owner_id = :owner_id` — read-only, validated
3. Query runs against Postgres, returns raw rows
4. LLM converts rows to plain-language answer in 1–3 sentences

### Bank import matching
1. CSV parsed to normalized rows (handles most Indian bank formats)
2. Batch of 10 rows sent to LLM with list of known party names
3. LLM matches by name similarity and infers transaction type
4. Returns confidence level per match — LOW/NONE rows deselected by default

All three use Groq's free tier. No embeddings, no vector DB, no LangChain needed.

---

## Roadmap (what's next)

- Voice input (Web Speech API — browser-native, free)
- OCR invoice photo upload (PaddleOCR)
- WhatsApp bot via Meta Business API
- Email morning digest (Resend free tier)
- GST report export
- Mobile PWA with offline entry
