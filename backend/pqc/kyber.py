# pyright: reportMissingImports=false
"""
kyber.py â€” CRYSTALS-Kyber Key Encapsulation Mechanism (KEM)

This module wraps liboqs-python's Kyber1024 implementation.
If liboqs is not installed, it automatically falls back to an
ECDH-P256 simulation so the demo always runs.

Real PQC: Kyber1024 (NIST Level 5, ~1568-byte public key)
Fallback:  ECDH-P256 (classical, NOT quantum-safe â€” clearly labelled)
"""

# pyright: reportMissingImports=false
from __future__ import annotations
import os
import base64
from typing import Tuple
from config import USE_LIBOQS  # type: ignore

# â”€â”€â”€ Mode Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try:
    if not USE_LIBOQS:
        raise ImportError("liboqs disabled by config flag")
    import oqs  # type: ignore
    _kyber = oqs.KeyEncapsulation("Kyber1024")
    MODE = "real"
except Exception:
    MODE = "simulation"

# â”€â”€â”€ Key type aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PublicKey = bytes
PrivateKey = bytes
Ciphertext = bytes
SharedSecret = bytes


# â”€â”€â”€ Real PQC: liboqs Kyber1024 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _real_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    """Generate a Kyber1024 key pair using liboqs."""
    kem = oqs.KeyEncapsulation("Kyber1024")
    pk = kem.generate_keypair()
    sk = kem.export_secret_key()
    kem.free()
    return pk, sk


def _real_encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    """Encapsulate against a Kyber1024 public key."""
    kem = oqs.KeyEncapsulation("Kyber1024")
    ct, ss = kem.encap_secret(public_key)
    kem.free()
    return ct, ss


def _real_decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    """Decapsulate a Kyber1024 ciphertext using the secret key."""
    kem = oqs.KeyEncapsulation("Kyber1024", secret_key)
    ss = kem.decap_secret(ciphertext)
    kem.free()
    return ss


# â”€â”€â”€ Simulation: ECDH-P256 fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _sim_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    """
    SIMULATION FALLBACK â€” NOT quantum-safe.
    Uses ECDH-P256 to mimic the KEM interface.
    """
    from cryptography.hazmat.primitives.asymmetric.ec import (
        generate_private_key, SECP256R1, EllipticCurvePublicKey
    )
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PublicFormat, PrivateFormat, NoEncryption
    )
    priv = generate_private_key(SECP256R1(), default_backend())
    pk_bytes = priv.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    sk_bytes = priv.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())
    return pk_bytes, sk_bytes


def _sim_encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    """
    SIMULATION FALLBACK â€” Generates an ephemeral ECDH pair and derives shared secret.
    The ephemeral public key is sent as the "ciphertext".
    """
    from cryptography.hazmat.primitives.asymmetric.ec import (
        generate_private_key, SECP256R1, ECDH
    )
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PublicFormat, load_der_public_key
    )
    backend = default_backend()
    ephemeral_priv = generate_private_key(SECP256R1(), backend)
    recipient_pub = load_der_public_key(public_key, backend)
    shared = ephemeral_priv.exchange(ECDH(), recipient_pub)
    ct = ephemeral_priv.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    return ct, shared


def _sim_decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    """SIMULATION FALLBACK â€” Recover shared secret via ECDH."""
    from cryptography.hazmat.primitives.asymmetric.ec import ECDH
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import (
        load_der_private_key, load_der_public_key
    )
    backend = default_backend()
    priv = load_der_private_key(secret_key, None, backend)
    ephem_pub = load_der_public_key(ciphertext, backend)
    return priv.exchange(ECDH(), ephem_pub)


# â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    """Generate a Kyber1024 key pair (real or simulated)."""
    if MODE == "real":
        return _real_generate_keypair()
    return _sim_generate_keypair()


def encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    """Encapsulate: generate shared secret + ciphertext from public key."""
    if MODE == "real":
        return _real_encapsulate(public_key)
    return _sim_encapsulate(public_key)


def decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    """Decapsulate: recover shared secret from ciphertext + secret key."""
    if MODE == "real":
        return _real_decapsulate(ciphertext, secret_key)
    return _sim_decapsulate(ciphertext, secret_key)


def encapsulate_with_key(public_key: PublicKey, session_key: bytes) -> bytes:
    """
    Wrap a known session_key under a recipient's public key using XOR + KEM.

    Process:
      1. Run normal KEM encapsulation against `public_key` → (ciphertext, shared_secret)
      2. XOR the shared_secret with session_key to produce a wrapped_key blob
      3. Return (ciphertext || wrapped_key) concatenated — the recipient can
         decapsulate to recover shared_secret, XOR to recover session_key.

    In simulation mode the ECDH shared secret is used the same way.
    This keeps the raw session_key off the wire and off the database.
    """
    ct, ss = encapsulate(public_key)
    # Pad / truncate shared secret to match session_key length
    ss_trimmed = (ss * ((len(session_key) // len(ss)) + 1))[:len(session_key)]
    wrapped = bytes(a ^ b for a, b in zip(session_key, ss_trimmed))
    # Prefix with 2-byte big-endian length of ct so decapsulation can split
    ct_len = len(ct).to_bytes(2, "big")
    return ct_len + ct + wrapped


def decapsulate_with_key(blob: bytes, secret_key: PrivateKey) -> bytes:
    """
    Reverse of encapsulate_with_key. Recovers the original session_key.

    1. Parse the blob: first 2 bytes = ct length, next ct_len bytes = KEM ciphertext,
       remainder = wrapped_key (XOR of session_key and shared_secret).
    2. Decapsulate the KEM ciphertext to recover shared_secret.
    3. XOR wrapped_key with shared_secret to recover session_key.
    """
    ct_len = int.from_bytes(blob[:2], "big")
    ct = blob[2 : 2 + ct_len]
    wrapped = blob[2 + ct_len :]

    ss = decapsulate(ct, secret_key)
    ss_trimmed = (ss * ((len(wrapped) // len(ss)) + 1))[:len(wrapped)]
    session_key = bytes(a ^ b for a, b in zip(wrapped, ss_trimmed))
    return session_key



def keypair_to_b64(pk: PublicKey, sk: PrivateKey) -> dict:
    """Serialise key pair to base64 dict for JSON transport."""
    return {
        "public_key": base64.b64encode(pk).decode(),
        "private_key": base64.b64encode(sk).decode(),
        "algorithm": "Kyber1024" if MODE == "real" else "ECDH-P256-fallback",
        "mode": MODE,
    }
