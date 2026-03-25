# pyright: reportMissingImports=false
"""
sphincs.py â€” SPHINCS+ Digital Signature Scheme

Wraps liboqs-python's SPHINCS+-SHA2-256f-simple.
Falls back to Ed25519 if liboqs is unavailable.

Real PQC: SPHINCS+-SHA2-256f-simple (NIST Level 5, stateless hash-based)
Fallback:  Ed25519 (classical, NOT quantum-safe â€” clearly labelled)
"""

# pyright: reportMissingImports=false
from __future__ import annotations
import base64
from typing import Tuple
from config import USE_LIBOQS  # type: ignore

# â”€â”€â”€ Mode Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try:
    if not USE_LIBOQS:
        raise ImportError("liboqs disabled by config flag")
    import oqs  # type: ignore
    _sig_name = "SPHINCS+-SHA2-256f-simple"
    _test_sig = oqs.Signature(_sig_name)
    _test_sig.free()
    MODE = "real"
except Exception:
    MODE = "simulation"

PublicKey = bytes
PrivateKey = bytes
Signature = bytes


# â”€â”€â”€ Real PQC: liboqs SPHINCS+ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _real_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    sig = oqs.Signature("SPHINCS+-SHA2-256f-simple")
    pk = sig.generate_keypair()
    sk = sig.export_secret_key()
    sig.free()
    return pk, sk


def _real_sign(message: bytes, secret_key: PrivateKey) -> Signature:
    sig = oqs.Signature("SPHINCS+-SHA2-256f-simple", secret_key)
    signature = sig.sign(message)
    sig.free()
    return signature


def _real_verify(message: bytes, signature: Signature, public_key: PublicKey) -> bool:
    sig = oqs.Signature("SPHINCS+-SHA2-256f-simple")
    try:
        result = sig.verify(message, signature, public_key)
    except Exception:
        result = False
    finally:
        sig.free()
    return result


# â”€â”€â”€ Simulation: Ed25519 fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _sim_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    """SIMULATION FALLBACK â€” Ed25519. NOT quantum-safe."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PublicFormat, PrivateFormat, NoEncryption
    )
    priv = Ed25519PrivateKey.generate()
    pk = priv.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    sk = priv.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    return pk, sk


def _sim_sign(message: bytes, secret_key: PrivateKey) -> Signature:
    """SIMULATION FALLBACK â€” Ed25519 sign."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
    priv = Ed25519PrivateKey.from_private_bytes(secret_key)
    return priv.sign(message)


def _sim_verify(message: bytes, signature: Signature, public_key: PublicKey) -> bool:
    """SIMULATION FALLBACK â€” Ed25519 verify."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    try:
        pub = Ed25519PublicKey.from_public_bytes(public_key)
        pub.verify(signature, message)
        return True
    except Exception:
        return False


# â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    if MODE == "real":
        return _real_generate_keypair()
    return _sim_generate_keypair()


def sign(message: bytes, secret_key: PrivateKey) -> Signature:
    if MODE == "real":
        return _real_sign(message, secret_key)
    return _sim_sign(message, secret_key)


def verify(message: bytes, signature: Signature, public_key: PublicKey) -> bool:
    if MODE == "real":
        return _real_verify(message, signature, public_key)
    return _sim_verify(message, signature, public_key)


def keypair_to_b64(pk: PublicKey, sk: PrivateKey) -> dict:
    return {
        "public_key": base64.b64encode(pk).decode(),
        "private_key": base64.b64encode(sk).decode(),
        "algorithm": "SPHINCS+-SHA2-256f-simple" if MODE == "real" else "Ed25519-fallback",
        "mode": MODE,
    }
