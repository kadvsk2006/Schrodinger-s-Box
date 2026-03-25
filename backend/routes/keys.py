# pyright: reportMissingImports=false
"""
routes/keys.py â€” Key Generation and Exchange API

POST /api/keys/generate
  Runs Kyber + McEliece key generation in parallel,
  fetches quantum entropy from the QRNG, fuses all secrets with HKDF,
  stores the session, and returns public keys + ciphertexts.
"""

from __future__ import annotations
import base64
import concurrent.futures
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pqc import kyber, mceliece, sphincs
from pqc.fusion import fuse_secrets
from quantum import qrng as qrng_mod
from core import session as session_store
from core import audit

router = APIRouter(prefix="/api/keys", tags=["Key Management"])


class GenerateResponse(BaseModel):
    session_id: str
    mode: str
    security_score: int
    kyber: dict
    mceliece: dict
    sphincs: dict
    quantum_entropy: dict
    session_key_b64: str   # NOTE: In production you'd NEVER send the session key to the client.
                            # This is exposed here ONLY for educational/demo visualization.
    algorithms_used: list[str]


@router.post("/generate", response_model=GenerateResponse)
async def generate_keys():
    """
    Full hybrid key generation endpoint.

    Steps:
      1. Parallel key generation: Kyber1024 + Classic McEliece + SPHINCS+
      2. Kyber encapsulation â†’ shared secret 1
      3. McEliece encapsulation â†’ shared secret 2
      4. Quantum QRNG â†’ entropy bytes (shared secret 3)
      5. HKDF fusion: SK = HKDF(SS1 â€– SS2 â€– entropy)
      6. Store all in session, compute security score.
    """
    sess = session_store.create()
    audit.record("SESSION_CREATED", session_id=sess.session_id, detail="New hybrid session created")

    # â”€â”€ Parallel PQC key generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fut_kyber    = pool.submit(kyber.generate_keypair)
        fut_mceliece = pool.submit(mceliece.generate_keypair)
        fut_sphincs  = pool.submit(sphincs.generate_keypair)

        kyber_pk,    kyber_sk    = fut_kyber.result()
        mceliece_pk, mceliece_sk = fut_mceliece.result()
        sphincs_pk,  sphincs_sk  = fut_sphincs.result()

    audit.record("KEY_GENERATION", sess.session_id, "Kyber1024",         "Keypair generated", True)
    audit.record("KEY_GENERATION", sess.session_id, "Classic-McEliece",  "Keypair generated", True)
    audit.record("KEY_GENERATION", sess.session_id, "SPHINCS+",          "Keypair generated", True)

    # â”€â”€ Encapsulation (sender side â€” in real system: separate client call) â”€â”€
    kyber_ct,    kyber_ss    = kyber.encapsulate(kyber_pk)
    mceliece_ct, mceliece_ss = mceliece.encapsulate(mceliece_pk)

    audit.record("KEY_ENCAPSULATION", sess.session_id, "Kyber1024",       "Encapsulation done", True)
    audit.record("KEY_ENCAPSULATION", sess.session_id, "Classic-McEliece","Encapsulation done", True)

    # â”€â”€ Quantum entropy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    quantum_result = qrng_mod.generate_entropy()
    q_entropy_bytes = bytes.fromhex(quantum_result["entropy_hex"])

    audit.record("QUANTUM_ENTROPY", sess.session_id, "QRNG",
                 f"Generated {quantum_result['bits_generated']} quantum bits", True)

    # â”€â”€ HKDF secret fusion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    session_key, salt = fuse_secrets([kyber_ss, mceliece_ss, q_entropy_bytes])

    # â”€â”€ Populate session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sess.kyber_keys    = {"public_key": kyber_pk,    "secret_key": kyber_sk,    "ciphertext": kyber_ct,    "shared_secret": kyber_ss}
    sess.mceliece_keys = {"public_key": mceliece_pk, "secret_key": mceliece_sk, "ciphertext": mceliece_ct, "shared_secret": mceliece_ss}
    sess.sphincs_keys  = {"public_key": sphincs_pk,  "secret_key": sphincs_sk}
    sess.session_key   = session_key
    sess.quantum_entropy = q_entropy_bytes

    mode = kyber.MODE  # "real" or "simulation"
    sess.mode = mode
    sess.algorithms_used = [
        "Kyber1024" if mode == "real" else "ECDH-fallback",
        "Classic-McEliece" if mode == "real" else "RSA-OAEP-fallback",
        "SPHINCS+" if mode == "real" else "Ed25519-fallback",
    ]
    sess.compute_security_score()

    return GenerateResponse(
        session_id=sess.session_id,
        mode=mode,
        security_score=sess.security_score,
        kyber={
            "public_key_b64":  base64.b64encode(kyber_pk).decode(),
            "ciphertext_b64":  base64.b64encode(kyber_ct).decode(),
            "public_key_bytes": len(kyber_pk),
            "ciphertext_bytes": len(kyber_ct),
            "algorithm": "Kyber1024" if mode == "real" else "ECDH-P256-fallback",
        },
        mceliece={
            "public_key_b64":  base64.b64encode(mceliece_pk).decode(),
            "ciphertext_b64":  base64.b64encode(mceliece_ct).decode(),
            "public_key_bytes": len(mceliece_pk),
            "ciphertext_bytes": len(mceliece_ct),
            "algorithm": "Classic-McEliece-348864" if mode == "real" else "RSA-OAEP-4096-fallback",
        },
        sphincs={
            "public_key_b64":   base64.b64encode(sphincs_pk).decode(),
            "public_key_bytes": len(sphincs_pk),
            "algorithm": "SPHINCS+-SHA2-256f-simple" if mode == "real" else "Ed25519-fallback",
        },
        quantum_entropy=quantum_result,
        session_key_b64=base64.b64encode(session_key).decode(),
        algorithms_used=sess.algorithms_used,
    )


@router.get("/sessions")
async def list_sessions():
    """List all active sessions (metadata only)."""
    return {"sessions": session_store.all_sessions()}

@router.get("/{session_id}", response_model=GenerateResponse)
async def get_session(session_id: str):
    """Retrieve an existing session's public metadata so Bob can join Alice's channel."""
    sess = session_store.get(session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
        
    mode = sess.mode
    return GenerateResponse(
        session_id=sess.session_id,
        mode=mode,
        security_score=sess.security_score,
        kyber={
            "public_key_b64":  base64.b64encode(sess.kyber_keys["public_key"]).decode(),
            "ciphertext_b64":  base64.b64encode(sess.kyber_keys.get("ciphertext", b"")).decode(),
            "public_key_bytes": len(sess.kyber_keys["public_key"]),
            "ciphertext_bytes": len(sess.kyber_keys.get("ciphertext", b"")),
            "algorithm": "Kyber1024" if mode == "real" else "ECDH-P256-fallback",
        },
        mceliece={
            "public_key_b64":  base64.b64encode(sess.mceliece_keys["public_key"]).decode(),
            "ciphertext_b64":  base64.b64encode(sess.mceliece_keys.get("ciphertext", b"")).decode(),
            "public_key_bytes": len(sess.mceliece_keys["public_key"]),
            "ciphertext_bytes": len(sess.mceliece_keys.get("ciphertext", b"")),
            "algorithm": "Classic-McEliece-348864" if mode == "real" else "RSA-OAEP-4096-fallback",
        },
        sphincs={
            "public_key_b64":   base64.b64encode(sess.sphincs_keys["public_key"]).decode(),
            "public_key_bytes": len(sess.sphincs_keys["public_key"]),
            "algorithm": "SPHINCS+-SHA2-256f-simple" if mode == "real" else "Ed25519-fallback",
        },
        quantum_entropy={
            "entropy_b64": base64.b64encode(sess.quantum_entropy).decode(),
            "bits_generated": len(sess.quantum_entropy) * 8,
            "mode": "simulation",
            "circuit_description": "Pulled from session cache",
            "entropy_hex": sess.quantum_entropy.hex()
        },
        session_key_b64=base64.b64encode(sess.session_key).decode(),
        algorithms_used=sess.algorithms_used,
    )
