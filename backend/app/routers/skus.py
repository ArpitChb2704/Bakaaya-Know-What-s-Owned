from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel

from app.auth import get_current_user, get_business_owner_id
from app.database import get_db
from app.models import User, SKU

router = APIRouter(prefix="/api/skus", tags=["skus"])


class SKUCreate(BaseModel):
    name: str
    unit: Optional[str] = None
    cost_price: Decimal
    selling_price: Decimal


class SKUUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None


class SKUOut(BaseModel):
    id: int
    name: str
    unit: Optional[str]
    cost_price: Decimal
    selling_price: Decimal
    is_archived: bool

    class Config:
        from_attributes = True


@router.get("", response_model=List[SKUOut])
def list_skus(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    return db.query(SKU).filter(SKU.owner_id == owner_id, SKU.is_archived == False).order_by(SKU.name).all()


@router.post("", response_model=SKUOut)
def create_sku(payload: SKUCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    sku = SKU(owner_id=owner_id, **payload.model_dump())
    db.add(sku)
    db.commit()
    db.refresh(sku)
    return sku


@router.patch("/{sku_id}", response_model=SKUOut)
def update_sku(sku_id: int, payload: SKUUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    sku = db.query(SKU).filter(SKU.id == sku_id, SKU.owner_id == owner_id).first()
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sku, key, value)
    db.commit()
    db.refresh(sku)
    return sku


@router.delete("/{sku_id}")
def archive_sku(sku_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_business_owner_id(current_user)
    sku = db.query(SKU).filter(SKU.id == sku_id, SKU.owner_id == owner_id).first()
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    sku.is_archived = True
    db.commit()
    return {"status": "archived"}