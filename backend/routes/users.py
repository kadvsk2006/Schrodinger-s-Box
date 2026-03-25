from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routes.deps import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/")
def get_all_users(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        all_users_count = db.query(User).count()
        users = db.query(User).filter(User.id != current_user.id).all()
        
        return {
            "count": len(users),
            "total_in_db": all_users_count,
            "current_user_id": current_user.id,
            "users": [{
                "id": u.id, 
                "username": u.username, 
                "kyber_pk": u.kyber_public_key_b64, 
                "mceliece_pk": u.mceliece_public_key_b64, 
                "role": u.role
            } for u in users]
        }
    except Exception as e:
        import traceback
        return {"error": traceback.format_exc()}
