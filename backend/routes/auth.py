from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import base64
import concurrent.futures

from database import get_db
from models import User
from core.security import hash_password, verify_password, create_access_token
from pqc import kyber

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Pre-warm a thread pool for keygen so the first request doesn't pay the pool startup cost
_keygen_pool = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="keygen")

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    username: str
    password: str


@router.post("/register")
@limiter.limit("10/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    # Only generate Kyber keys during registration — it's fast (~10 ms).
    # McEliece-8192128 keygen takes 5-15 s and is only needed for the
    # session-based key fusion (not the E2E messenger), so we skip it here.
    k_pk, k_sk = kyber.generate_keypair()

    new_user = User(
        username=user.username,
        password_hash=hash_password(user.password),
        role=user.role,
        kyber_public_key_b64=base64.b64encode(k_pk).decode(),
        mceliece_public_key_b64=""   # generated on-demand when session keys are requested
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.username, "id": new_user.id, "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": new_user.id, "username": new_user.username},
        "private_keys": {
            "kyber_sk": base64.b64encode(k_sk).decode(),
            "mceliece_sk": ""   # populated when first needed
        }
    }


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": db_user.username, "id": db_user.id, "role": db_user.role})
    return {"access_token": token, "token_type": "bearer", "user": {"id": db_user.id, "username": db_user.username}}
