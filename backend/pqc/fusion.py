# pyright: reportMissingImports=false
"""
fusion.py â€” HKDF-based Secret Fusion Layer

Combines shared secrets from multiple PQC KEMs plus quantum entropy
into a single 256-bit AES session key using HKDF (RFC 5869).

WHY THIS MATTERS:
  Even if one KEM is secretly broken (e.g., a mathematical breakthrough),
  the attacker still needs to break ALL other algorithms simultaneously.
  This is the "hybrid" defence-in-depth posture.

  Session key = HKDF(
      ikm  = Kyber_SS || McEliece_SS || quantum_entropy,
      salt = random 32-byte salt,
      info = b"schrodingers-box-v1-session-key",
      len  = 32
  )
"""

# pyright: reportMissingImports=false
from __future__ import annotations
import os
import hashlib
import hmac
from typing import Sequence
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from config import HKDF_INFO, SESSION_KEY_LENGTH


def fuse_secrets(
    secrets: Sequence[bytes],
    salt: bytes | None = None,
) -> tuple[bytes, bytes]:
    """
    Fuse multiple shared secrets into one 256-bit key using HKDF-SHA256.

    Args:
        secrets: Ordered list of shared secrets (from Kyber, McEliece, QRNG, â€¦).
                 They are concatenated as the HKDF input key material.
        salt:    Optional random salt. If None, a 32-byte random salt is generated.

    Returns:
        (session_key, salt) â€” session_key is 32 bytes (256 bits).
    """
    if not secrets:
        raise ValueError("At least one secret is required for fusion.")

    # Concatenate all secrets as Input Key Material (IKM)
    ikm: bytes = b"".join(secrets)

    # Generate salt if not provided
    if salt is None:
        salt = os.urandom(32)

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=SESSION_KEY_LENGTH,
        salt=salt,
        info=HKDF_INFO,
        backend=default_backend(),
    )
    session_key = hkdf.derive(ikm)
    return session_key, salt


def derive_nonce(session_key: bytes, counter: int = 0) -> bytes:
    """
    Derive a 12-byte GCM nonce from the session key and a counter.
    This avoids nonce reuse while allowing deterministic nonces for sessions.

    Uses HKDF-SHA256 with counter-specific info to generate unique nonces.
    """
    info = HKDF_INFO + b"-nonce-" + counter.to_bytes(4, "big")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=12,  # GCM standard nonce size
        salt=None,
        info=info,
        backend=default_backend(),
    )
    return hkdf.derive(session_key)
