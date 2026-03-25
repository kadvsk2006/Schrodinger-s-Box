# pyright: reportMissingImports=false
"""
aes.py â€” AES-256-GCM Authenticated Encryption

Provides authenticated encryption/decryption using AES-256-GCM.

AES-256-GCM gives us:
  - Confidentiality: 256-bit key strength
  - Integrity:       GHASH authentication tag (128 bits)
  - Authenticity:    Implicitly via the tag

The session key (derived from PQC + QRNG via HKDF) is the AES key.
A fresh random 12-byte nonce is generated per encryption operation.

Wire format (concatenated bytes):
  [ nonce (12 bytes) | tag (16 bytes) | ciphertext (variable) ]
"""

# pyright: reportMissingImports=false
from __future__ import annotations
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt(plaintext: bytes, key: bytes, associated_data: bytes | None = None) -> bytes:
    """
    Encrypt plaintext with AES-256-GCM.

    Args:
        plaintext:       Raw bytes to encrypt.
        key:             32-byte session key.
        associated_data: Optional AD for authentication (e.g. session_id bytes).

    Returns:
        Combined bytes: nonce (12) + tag (16) + ciphertext.
    """
    if len(key) != 32:
        raise ValueError(f"AES-256 requires a 32-byte key; got {len(key)} bytes.")

    nonce = os.urandom(12)  # GCM standard: 96-bit random nonce
    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns ciphertext + tag (last 16 bytes)
    ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext, associated_data)
    return nonce + ciphertext_with_tag


def decrypt(ciphertext_bundle: bytes, key: bytes, associated_data: bytes | None = None) -> bytes:
    """
    Decrypt and authenticate AES-256-GCM ciphertext bundle.

    Args:
        ciphertext_bundle: Output of `encrypt()` â€” nonce + tag + ciphertext.
        key:               32-byte session key.
        associated_data:   Must match what was used during encryption.

    Returns:
        Decrypted plaintext bytes.

    Raises:
        cryptography.exceptions.InvalidTag: If authentication fails (tampered).
    """
    if len(key) != 32:
        raise ValueError(f"AES-256 requires a 32-byte key; got {len(key)} bytes.")
    if len(ciphertext_bundle) < 28:  # 12 nonce + 16 tag minimum
        raise ValueError("Ciphertext bundle too short to be valid AES-GCM output.")

    nonce = ciphertext_bundle[:12]
    payload = ciphertext_bundle[12:]  # ciphertext + GCM tag
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, payload, associated_data)


def encrypt_b64(plaintext: str | bytes, key: bytes, associated_data: bytes | None = None) -> str:
    """Encrypt and return base64-encoded ciphertext bundle."""
    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")
    bundle = encrypt(plaintext, key, associated_data)
    return base64.b64encode(bundle).decode()


def decrypt_b64(ciphertext_b64: str, key: bytes, associated_data: bytes | None = None) -> str:
    """Decrypt a base64-encoded ciphertext bundle and return UTF-8 plaintext."""
    bundle = base64.b64decode(ciphertext_b64)
    plaintext_bytes = decrypt(bundle, key, associated_data)
    return plaintext_bytes.decode("utf-8")
