from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
import secrets

from app.database import get_db
from app.models import Admin, User, Payment, UserRole
from app.auth import verify_password, hash_password
from app.admin_auth import create_admin_token, get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login")
def admin_login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == form.username).first()
    if not admin or not verify_password(form.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"access_token": create_admin_token(admin.id), "token_type": "bearer"}


class BusinessOut(BaseModel):
    id: int
    business_name: Optional[str]
    email: str
    plan_status: str
    plan_valid_until: Optional[date]
    created_at: Optional[object]

    class Config:
        from_attributes = True


@router.get("/businesses", response_model=List[BusinessOut])
def list_businesses(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(User).filter(User.role == UserRole.owner).order_by(User.created_at.desc()).all()


@router.get("/businesses/{business_id}", response_model=BusinessOut)
def get_business(business_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


@router.patch("/businesses/{business_id}", response_model=BusinessOut)
def update_business(business_id: int, payload: BusinessUpdate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(biz, key, value)
    db.commit()
    db.refresh(biz)
    return biz


class PaymentIn(BaseModel):
    amount: Decimal
    plan_type: str  # "monthly" or "annual"
    payment_date: date = date.today()
    notes: Optional[str] = None


@router.post("/businesses/{business_id}/payment", response_model=BusinessOut)
def record_payment(business_id: int, payload: PaymentIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    db.add(Payment(owner_id=biz.id, amount=payload.amount, payment_date=payload.payment_date,
                    plan_type=payload.plan_type, notes=payload.notes))

    days = 365 if payload.plan_type == "annual" else 30
    base = biz.plan_valid_until if biz.plan_valid_until and biz.plan_valid_until > date.today() else date.today()
    biz.plan_valid_until = base + timedelta(days=days)
    biz.plan_status = "active"

    db.commit()
    db.refresh(biz)
    return biz


@router.post("/businesses/{business_id}/suspend", response_model=BusinessOut)
def suspend_business(business_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    biz.plan_status = "suspended"
    db.commit()
    db.refresh(biz)
    return biz


@router.post("/businesses/{business_id}/reactivate", response_model=BusinessOut)
def reactivate_business(business_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    biz.plan_status = "active"
    db.commit()
    db.refresh(biz)
    return biz


@router.post("/businesses/{business_id}/reset-password")
def reset_business_password(business_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    biz = db.query(User).filter(User.id == business_id, User.role == UserRole.owner).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    temp_password = secrets.token_urlsafe(9)
    biz.hashed_password = hash_password(temp_password)
    db.commit()
    return {"temp_password": temp_password}