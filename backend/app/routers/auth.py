import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_owner
from app.database import get_db
from app.models import User, UserRole, TeamInvite
from app.schemas import SignupRequest, LoginRequest, TokenResponse, TeamInviteRequest, TeamInviteAccept, TeamMemberOut
from typing import List

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = User(business_name=payload.business_name, email=payload.email, hashed_password=hash_password(payload.password), role=UserRole.owner)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, business_name=user.business_name, role=user.role.value)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    biz_name = user.business_name
    if not biz_name and user.business_id:
        owner = db.query(User).filter(User.id == user.business_id).first()
        biz_name = owner.business_name if owner else "Business"
    return TokenResponse(access_token=token, business_name=biz_name or "Business", role=user.role.value)


@router.post("/team/invite")
def invite_team_member(payload: TeamInviteRequest, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    if payload.role == UserRole.owner:
        raise HTTPException(status_code=400, detail="Cannot invite another owner")
    token = secrets.token_urlsafe(32)
    invite = TeamInvite(owner_id=owner.id, email=payload.email, role=payload.role, token=token)
    db.add(invite)
    db.commit()
    return {"invite_token": token, "email": payload.email, "role": payload.role, "message": f"Share this token with {payload.email} to join your team"}


@router.post("/team/accept", response_model=TokenResponse)
def accept_invite(payload: TeamInviteAccept, db: Session = Depends(get_db)):
    invite = db.query(TeamInvite).filter(TeamInvite.token == payload.token, TeamInvite.accepted == False).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or already used invite token")
    if db.query(User).filter(User.email == invite.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    owner = db.query(User).filter(User.id == invite.owner_id).first()
    user = User(email=invite.email, hashed_password=hash_password(payload.password), role=invite.role, business_id=invite.owner_id)
    db.add(user)
    invite.accepted = True
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, business_name=owner.business_name or "Business", role=user.role.value)


@router.get("/team", response_model=List[TeamMemberOut])
def list_team(db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    return db.query(User).filter(User.business_id == owner.id, User.is_active == True).all()


@router.delete("/team/{user_id}")
def remove_team_member(user_id: int, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    member = db.query(User).filter(User.id == user_id, User.business_id == owner.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    member.is_active = False
    db.commit()
    return {"ok": True}
