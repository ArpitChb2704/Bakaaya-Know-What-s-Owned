from datetime import datetime, date
import enum
from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime, Boolean,
    ForeignKey, Enum, Text, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class PartyType(str, enum.Enum):
    supplier = "supplier"
    customer = "customer"


class TransactionType(str, enum.Enum):
    bill = "bill"
    payment_out = "payment_out"
    sale = "sale"
    payment_in = "payment_in"


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    called = "called"
    visited = "visited"
    email_sent = "email_sent"
    payment_promised = "payment_promised"
    paid = "paid"


class UserRole(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    accountant = "accountant"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String, nullable=True)   # null for non-owner team members
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.owner)
    business_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # owner's user.id for team members
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    parties = relationship("Party", back_populates="owner", foreign_keys="Party.owner_id", cascade="all, delete-orphan")


class Party(Base):
    __tablename__ = "parties"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # always the business owner's id
    name = Column(String, nullable=False, index=True)
    party_type = Column(Enum(PartyType), nullable=False)
    phone = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    credit_period_days = Column(Integer, default=7)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_archived = Column(Boolean, default=False)
    risk_score = Column(Float, nullable=True)
    risk_label = Column(String, nullable=True)
    risk_reasons = Column(Text, nullable=True)
    owner = relationship("User", back_populates="parties", foreign_keys=[owner_id])
    transactions = relationship("Transaction", back_populates="party", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="party", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    party_id = Column(Integer, ForeignKey("parties.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    transaction_date = Column(Date, default=date.today, nullable=False)
    due_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # who logged it
    requires_approval = Column(Boolean, default=False)  # flagged for owner approval
    approved = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    party = relationship("Party", back_populates="transactions")


class ChatLog(Base):
    __tablename__ = "chat_logs"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    party_id = Column(Integer, ForeignKey("parties.id"), nullable=False)
    status = Column(Enum(ReminderStatus), default=ReminderStatus.pending)
    notes = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)
    amount_at_time = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    party = relationship("Party", back_populates="reminders")


class TeamInvite(Base):
    __tablename__ = "team_invites"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.accountant)
    token = Column(String, unique=True, nullable=False)
    accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
