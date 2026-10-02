from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr
from app.models import PartyType, TransactionType, ReminderStatus, UserRole


# ---------- Auth ----------
class SignupRequest(BaseModel):
    business_name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    business_name: str
    role: str = "owner"

class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.accountant

class TeamInviteAccept(BaseModel):
    token: str
    password: str

class TeamMemberOut(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ---------- Party ----------
class PartyCreate(BaseModel):
    name: str
    party_type: PartyType
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    notes: Optional[str] = None
    credit_period_days: int = 7

class PartyUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    notes: Optional[str] = None
    credit_period_days: Optional[int] = None
    is_archived: Optional[bool] = None

class PartyOut(BaseModel):
    id: int
    name: str
    party_type: PartyType
    phone: Optional[str]
    gst_number: Optional[str] = None
    notes: Optional[str]
    credit_period_days: int
    is_archived: bool
    balance: Decimal = Decimal("0")
    days_outstanding: Optional[int] = None
    risk_score: Optional[float] = None
    risk_label: Optional[str] = None
    risk_reasons: Optional[str] = None
    class Config:
        from_attributes = True


# ---------- Transaction ----------

class TransactionItemIn(BaseModel):
    sku_id: Optional[int] = None
    item_name: str
    quantity: Decimal
    unit_price: Decimal

class TransactionCreate(BaseModel):
    party_id: int
    transaction_type: TransactionType
    amount: Decimal
    transaction_date: date = date.today()
    due_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[TransactionItemIn]] = None

class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = None
    transaction_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    party_id: int
    transaction_type: TransactionType
    amount: Decimal
    transaction_date: date
    due_date: Optional[date]
    notes: Optional[str]
    requires_approval: bool = False
    approved: Optional[bool] = None
    created_at: datetime
    class Config:
        from_attributes = True

class DuplicateCheck(BaseModel):
    is_duplicate: bool
    existing_id: Optional[int] = None
    existing_date: Optional[date] = None
    existing_notes: Optional[str] = None


# ---------- Dashboard ----------
class DashboardSummary(BaseModel):
    total_receivable: Decimal
    total_payable: Decimal
    overdue_count: int
    overdue_amount: Decimal
    high_risk_count: int
    upcoming_week_amount: Decimal

class CalendarEvent(BaseModel):
    date: date
    party_name: str
    party_id: int
    party_type: PartyType
    event_type: str
    amount: Decimal


# ---------- Smart Entry ----------
class SmartEntryRequest(BaseModel):
    text: str

class SmartEntryParsed(BaseModel):
    party_name: str
    party_type: PartyType
    transaction_type: TransactionType
    amount: Decimal
    transaction_date: date
    notes: Optional[str] = None
    confidence: str
    raw_text: str

class SmartEntryResponse(BaseModel):
    parsed: Optional[SmartEntryParsed] = None
    error: Optional[str] = None


# ---------- AI Chat ----------
class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str
    generated_sql: Optional[str] = None


# ---------- Reminders ----------
class ReminderCreate(BaseModel):
    party_id: int
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None
    amount_at_time: Optional[Decimal] = None

class ReminderUpdate(BaseModel):
    status: Optional[ReminderStatus] = None
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None

class ReminderOut(BaseModel):
    id: int
    party_id: int
    status: ReminderStatus
    notes: Optional[str]
    follow_up_date: Optional[date]
    amount_at_time: Optional[Decimal]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


# ---------- Risk ----------
class RiskOut(BaseModel):
    party_id: int
    risk_score: float
    risk_label: str
    risk_reasons: List[str]


# ---------- Bank Statement ----------
class BankRow(BaseModel):
    date: date
    description: str
    amount: Decimal
    transaction_type: str  # 'credit' or 'debit'
    reference: Optional[str] = None

class BankMatch(BaseModel):
    row: BankRow
    matched_party: Optional[str] = None
    matched_party_id: Optional[int] = None
    suggested_type: Optional[TransactionType] = None
    confidence: str  # HIGH / MEDIUM / LOW / NONE
    selected: bool = True

class BankImportConfirm(BaseModel):
    matches: List[BankMatch]


# ---------- Statement PDF ----------
class StatementRequest(BaseModel):
    party_id: int
    from_date: Optional[date] = None
    to_date: Optional[date] = None


# ---------- UPI Payment Link ----------
class UPILinkRequest(BaseModel):
    party_id: int
    amount: Optional[Decimal] = None  # if None, use full outstanding balance
    upi_id: str  # business owner's UPI ID

class UPILinkResponse(BaseModel):
    upi_link: str
    whatsapp_message: str
    amount: Decimal
    party_name: str


# ---------- Cashflow Forecast ----------
class ForecastWeek(BaseModel):
    week_start: date
    week_end: date
    expected_inflow: Decimal
    expected_outflow: Decimal
    net: Decimal
    gap: Optional[Decimal] = None

class CashflowForecast(BaseModel):
    weeks: List[ForecastWeek]
    summary: str
    warning: Optional[str] = None


# ---------- Supplier Performance ----------
class SupplierScore(BaseModel):
    party_id: int
    party_name: str
    avg_payment_days: Optional[float]
    total_billed: Decimal
    total_paid: Decimal
    payment_ratio: float
    outstanding: Decimal
    score: float        # 0-100, higher = better supplier relationship
    grade: str          # A / B / C / D
    insight: str
