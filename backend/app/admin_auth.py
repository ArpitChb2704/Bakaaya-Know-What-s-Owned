from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Admin
from app.auth import create_access_token

admin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/login")


def create_admin_token(admin_id: int) -> str:
    return create_access_token({"sub": str(admin_id), "type": "admin"})


def get_current_admin(token: str = Depends(admin_oauth2_scheme), db: Session = Depends(get_db)) -> Admin:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate admin credentials")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "admin":
            raise exc
        admin_id = payload.get("sub")
        if admin_id is None:
            raise exc
    except JWTError:
        raise exc
    admin = db.query(Admin).filter(Admin.id == int(admin_id)).first()
    if admin is None:
        raise exc
    return admin