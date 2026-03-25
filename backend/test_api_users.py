
import sqlite3
import jwt
import os
import requests

# Add current dir to path
import sys
sys.path.append(os.getcwd())

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-quantum-key-for-dev")
ALGORITHM = "HS256"

def get_token(username):
    payload = {"sub": username}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def test_api():
    token = get_token("Praveen")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get("http://127.0.0.1:8000/api/users/", headers=headers)
        print(f"Status: {r.status_code}")
        print(f"Body: {r.json()}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_api()
