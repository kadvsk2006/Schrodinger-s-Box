# pyright: reportMissingImports=false
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
import base64

from pqc import stego
from crypto import aes
from core import session, audit

router = APIRouter(prefix="/api/stego", tags=["Steganography"])

@router.post("/hide")
async def hide_message(
    session_id: str = Form(...),
    message: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Encrypts a message using the session's hybrid key, generates a QRNG seed,
    and scatters the ciphertext inside the provided image.
    Returns the steganographic PNG image bytes and the base64 QRNG seed.
    """
    sess = session.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        # 1. Encrypt message
        ct_bytes = aes.encrypt(message.encode(), sess.session_key)
        
        # 2. Get QRNG Seed
        from quantum import qrng
        seed_bytes = qrng.get_entropy_bytes(128) # 16-byte quantum seed for stego scatter
        seed_b64 = base64.b64encode(seed_bytes).decode('utf-8')
        
        # 3. Read input image and Embed
        img_bytes = await image.read()
        stego_img_bytes = stego.embed_data(img_bytes, ct_bytes, seed_bytes)
        
        audit.record(
            "STEGO_EMBED",
            session_id=session_id,
            algorithm="Q-Steg LSB",
            detail=f"Embedded {len(ct_bytes)} bytes into {image.filename} using QRNG seed."
        )
        
        # Return image as file, and put the QRNG seed in a custom header so frontend can read it
        return Response(
            content=stego_img_bytes,
            media_type="image/png",
            headers={
                "X-Quantum-Seed": seed_b64,
                "Content-Disposition": "attachment; filename=stego_quantum.png"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/extract")
async def extract_message(
    session_id: str = Form(...),
    seed_b64: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Extracts ciphertext from image using the QRNG seed, then decrypts it using session key.
    """
    sess = session.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        seed_bytes = base64.b64decode(seed_b64)
        img_bytes = await image.read()
        
        # 1. Extract ciphertext
        ct_bytes = stego.extract_data(img_bytes, seed_bytes)
        
        # 2. Decrypt
        plaintext_bytes = aes.decrypt(ct_bytes, sess.session_key)
        
        audit.record(
            "STEGO_EXTRACT",
            session_id=session_id,
            algorithm="Q-Steg LSB",
            detail="Successfully extracted and decrypted steganographic payload."
        )
        
        return {
            "success": True,
            "plaintext": plaintext_bytes.decode('utf-8')
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
