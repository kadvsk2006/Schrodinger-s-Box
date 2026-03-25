# pyright: reportMissingImports=false
"""
routes/messages.py â€” Encrypt, Decrypt, Sign, Verify API

POST /api/messages/encrypt  â†’ AES-256-GCM encrypt a plaintext string
POST /api/messages/decrypt  â†’ Decrypt ciphertext bundle
POST /api/messages/sign     â†’ SPHINCS+ sign message hash
POST /api/messages/verify   â†’ Verify SPHINCS+ signature
"""

from __future__ import annotations
import base64
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from core import session as session_store, audit
from crypto import aes
from pqc import sphincs, custom_algo

router = APIRouter(prefix="/api/messages", tags=["Message Crypto"])


# â”€â”€â”€ Request / Response Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class EncryptRequest(BaseModel):
    session_id: Optional[str] = None
    session_key_b64: Optional[str] = None
    plaintext: str
    use_custom_algo: bool = False

class EncryptResponse(BaseModel):
    session_id: Optional[str] = None # Changed to Optional as session_key_b64 can be used directly
    ciphertext_b64: str
    ciphertext_bytes: int
    algorithm: str = "AES-256-GCM"
    authenticated: bool = True

class DecryptRequest(BaseModel):
    session_id: Optional[str] = None
    session_key_b64: Optional[str] = None
    ciphertext_b64: str
    use_custom_algo: bool = False

class DecryptResponse(BaseModel):
    session_id: Optional[str] = None # Changed to Optional
    plaintext: str
    verified: bool

class SignRequest(BaseModel):
    session_id: str
    message: str

class SignResponse(BaseModel):
    session_id: str
    message_b64: str
    signature_b64: str
    signature_bytes: int
    algorithm: str

class VerifyRequest(BaseModel):
    session_id: str
    message_b64: str
    signature_b64: str

class VerifyResponse(BaseModel):
    session_id: str
    valid: bool
    algorithm: str


class ChatMessage(BaseModel):
    session_id: str
    role: str
    ciphertext_b64: str = ""
    signature_b64: str = ""
    message_b64: str = ""
    stego_image_b64: str | None = None
    stego_seed: str | None = None
    audio_data_b64: str | None = None
    audio_iv_b64: str | None = None
    audio_key_b64: str | None = None
    file_data_b64: str | None = None
    file_name: str | None = None
    file_type: str | None = None
    file_iv_b64: str | None = None
    file_key_b64: str | None = None

@router.post("/send")
async def send_chat_message(req: ChatMessage):
    sess = session_store.get(req.session_id)
    if not sess: raise HTTPException(404, "Session not found")
    
    msg_id = len(sess.messages) + 1
    msg_dict = req.dict()
    msg_dict["id"] = msg_id
    sess.messages.append(msg_dict)
    return {"success": True, "id": msg_id}

@router.get("/sync/{session_id}")
async def sync_messages(session_id: str):
    sess = session_store.get(session_id)
    if not sess: raise HTTPException(404, "Session not found")
    return {"messages": sess.messages}

# â”€â”€â”€ Encrypt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.post("/encrypt", response_model=EncryptResponse)
async def encrypt_message(req: EncryptRequest):
    """
    Encrypt a plaintext message using the session's AES-256-GCM key.
    The session ID is used as associated data for authentication.
    """
    sess = session_store.get(req.session_id)
    if sess is None:
        raise HTTPException(404, detail=f"Session {req.session_id} not found. Generate keys first.")
    if sess.session_key is None:
        raise HTTPException(400, detail="Session key not yet derived. Call /api/keys/generate first.")

    try:
        if req.use_custom_algo:
            ciphertext_bundle = custom_algo.encrypt(sess.session_key, req.plaintext.encode("utf-8"))
            algo_used = "User Custom BYOA"
        else:
            ciphertext_bundle = aes.encrypt(
                plaintext=req.plaintext.encode("utf-8"),
                key=sess.session_key,
                associated_data=req.session_id.encode("utf-8"),
            )
            algo_used = "Hybrid Kyber+McEliece (AES)"
    except Exception as e:
        audit.record("ENCRYPT", req.session_id, "AES-256-GCM", f"Encryption failed: {e}", False)
        raise HTTPException(500, detail=f"Encryption error: {e}")

    ciphertext_b64 = base64.b64encode(ciphertext_bundle).decode()
    audit.record("ENCRYPT", req.session_id, algo_used,
                 f"Encrypted {len(req.plaintext)} chars â†’ {len(ciphertext_bundle)} bytes", True)

    return EncryptResponse(
        session_id=req.session_id,
        ciphertext_b64=ciphertext_b64,
        ciphertext_bytes=len(ciphertext_bundle),
        algorithm=algo_used,
    )


# â”€â”€â”€ Decrypt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.post("/decrypt", response_model=DecryptResponse)
async def decrypt_message(req: DecryptRequest):
    """Decrypt an AES-256-GCM ciphertext bundle."""
    sess = session_store.get(req.session_id)
    if sess is None:
        raise HTTPException(404, detail=f"Session {req.session_id} not found.")

    try:
        bundle = base64.b64decode(req.ciphertext_b64)
        if req.use_custom_algo:
            plaintext = custom_algo.decrypt(sess.session_key, bundle)
            algo_used = "User Custom BYOA"
        else:
            plaintext = aes.decrypt(
                ciphertext_bundle=bundle,
                key=sess.session_key,
                associated_data=req.session_id.encode("utf-8"),
            )
            algo_used = "AES-256-GCM"
        verified = True
    except Exception as e:
        audit.record("DECRYPT", req.session_id, "AES-256-GCM", f"Decryption failed: {e}", False)
        raise HTTPException(400, detail=f"Decryption / authentication failed: {e}")

    audit.record("DECRYPT", req.session_id, algo_used, "Message decrypted and authenticated", True)
    return DecryptResponse(session_id=req.session_id, plaintext=plaintext.decode("utf-8"), verified=verified)


# â”€â”€â”€ Sign â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.post("/sign", response_model=SignResponse)
async def sign_message(req: SignRequest):
    """Sign a message with SPHINCS+ (or Ed25519 fallback)."""
    sess = session_store.get(req.session_id)
    if sess is None:
        raise HTTPException(404, detail=f"Session {req.session_id} not found.")
    if not sess.sphincs_keys:
        raise HTTPException(400, detail="SPHINCS+ keys not generated yet.")

    message_bytes = req.message.encode("utf-8")
    sk = sess.sphincs_keys["secret_key"]
    sig = sphincs.sign(message_bytes, sk)

    sig_b64 = base64.b64encode(sig).decode()
    msg_b64 = base64.b64encode(message_bytes).decode()
    algo = "SPHINCS+-SHA2-256f-simple" if sphincs.MODE == "real" else "Ed25519-fallback"

    audit.record("SIGN", req.session_id, algo,
                 f"Signed {len(message_bytes)}-byte message, sig={len(sig)} bytes", True)

    return SignResponse(
        session_id=req.session_id,
        message_b64=msg_b64,
        signature_b64=sig_b64,
        signature_bytes=len(sig),
        algorithm=algo,
    )


# â”€â”€â”€ Verify â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@router.post("/verify", response_model=VerifyResponse)
async def verify_message(req: VerifyRequest):
    """Verify a SPHINCS+ signature."""
    sess = session_store.get(req.session_id)
    if sess is None:
        raise HTTPException(404, detail=f"Session {req.session_id} not found.")
    if not sess.sphincs_keys:
        raise HTTPException(400, detail="SPHINCS+ keys not generated yet.")

    try:
        message_bytes = base64.b64decode(req.message_b64)
        sig_bytes     = base64.b64decode(req.signature_b64)
        pk            = sess.sphincs_keys["public_key"]
        valid         = sphincs.verify(message_bytes, sig_bytes, pk)
    except Exception as e:
        raise HTTPException(400, detail=f"Verification error: {e}")

    algo = "SPHINCS+-SHA2-256f-simple" if sphincs.MODE == "real" else "Ed25519-fallback"
    audit.record("VERIFY", req.session_id, algo,
                 f"Signature {'valid' if valid else 'INVALID'}", valid)

    return VerifyResponse(session_id=req.session_id, valid=valid, algorithm=algo)
