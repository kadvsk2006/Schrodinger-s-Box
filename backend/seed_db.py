
import sys
import os
import base64

# Ensure backend root is in path
sys.path.append(os.getcwd())

from database import SessionLocal, engine
from models import User, Base
from core.security import hash_password
from pqc import kyber, mceliece

def seed():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    test_users = ["Alice", "Bob", "Charlie"]
    password = "password123"
    
    for username in test_users:
        if db.query(User).filter(User.username == username).first():
            print(f"User {username} already exists, skipping.")
            continue
            
        print(f"Generating PQC keys for {username}...")
        k_pk, _ = kyber.generate_keypair()
        m_pk, _ = mceliece.generate_keypair()
        
        user = User(
            username=username,
            password_hash=hash_password(password),
            kyber_public_key_b64=base64.b64encode(k_pk).decode(),
            mceliece_public_key_b64=base64.b64encode(m_pk).decode(),
            role="user"
        )
        db.add(user)
        print(f"User {username} seeded.")
    
    db.commit()
    db.close()
    print("Database seeding complete. You can login with username 'Alice' and password 'password123'")

if __name__ == "__main__":
    seed()
