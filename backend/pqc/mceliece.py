# pyright: reportMissingImports=false
"""
mceliece.py â€” Classic McEliece Key Encapsulation Mechanism (KEM)

Wraps liboqs-python's Classic-McEliece-348864.
Falls back to RSA-OAEP-4096 if liboqs is unavailable.

Real PQC: Classic-McEliece-348864 (NIST Level 1, ~261 KB public key)
Fallback:  RSA-OAEP-4096 (classical, NOT quantum-safe â€” clearly labelled)

NOTE: McEliece key generation is intentionally slow (~seconds) owing to
its large public key size â€” this is mathematically expected and is actually
a security feature (conservative parameters). The benchmark will show this.
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
    _test_kem = oqs.KeyEncapsulation("Classic-McEliece-348864")
    _test_kem.free()
    MODE = "real"
except Exception:
    MODE = "simulation"

PublicKey = bytes
PrivateKey = bytes
Ciphertext = bytes
SharedSecret = bytes


# â”€â”€â”€ Real PQC: Classic McEliece â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _real_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    kem = oqs.KeyEncapsulation("Classic-McEliece-348864")
    pk = kem.generate_keypair()
    sk = kem.export_secret_key()
    kem.free()
    return pk, sk


def _real_encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    kem = oqs.KeyEncapsulation("Classic-McEliece-348864")
    ct, ss = kem.encap_secret(public_key)
    kem.free()
    return ct, ss


def _real_decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    kem = oqs.KeyEncapsulation("Classic-McEliece-348864", secret_key)
    ss = kem.decap_secret(ciphertext)
    kem.free()
    return ss


# â”€â”€â”€ Simulation: RSA-OAEP-4096 fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _sim_generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    """SIMULATION FALLBACK â€” RSA-4096 OAEP. NOT quantum-safe."""
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PublicFormat, PrivateFormat, NoEncryption
    )
    priv = rsa.generate_private_key(
        public_exponent=65537, key_size=4096, backend=default_backend()
    )
    pk = priv.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    sk = priv.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())
    return pk, sk


def _sim_encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    """SIMULATION FALLBACK â€” Encrypt a random 32-byte secret with RSA-OAEP."""
    import os
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import load_der_public_key
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
    ss = os.urandom(32)  # random shared secret
    pub = load_der_public_key(public_key, default_backend())
    ct = pub.encrypt(ss, padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
    return ct, ss


def _sim_decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    """SIMULATION FALLBACK â€” Decrypt RSA-OAEP ciphertext to recover shared secret."""
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import load_der_private_key
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
    priv = load_der_private_key(secret_key, None, default_backend())
    ss = priv.decrypt(ciphertext, padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
    return ss


# â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def generate_keypair() -> Tuple[PublicKey, PrivateKey]:
    if MODE == "real":
        return _real_generate_keypair()
    return _sim_generate_keypair()


def encapsulate(public_key: PublicKey) -> Tuple[Ciphertext, SharedSecret]:
    if MODE == "real":
        return _real_encapsulate(public_key)
    return _sim_encapsulate(public_key)


def decapsulate(ciphertext: Ciphertext, secret_key: PrivateKey) -> SharedSecret:
    if MODE == "real":
        return _real_decapsulate(ciphertext, secret_key)
    return _sim_decapsulate(ciphertext, secret_key)


def keypair_to_b64(pk: PublicKey, sk: PrivateKey) -> dict:
    return {
        "public_key": base64.b64encode(pk).decode(),
        "private_key": base64.b64encode(sk).decode(),
        "algorithm": "Classic-McEliece-348864" if MODE == "real" else "RSA-OAEP-4096-fallback",
        "mode": MODE,
    }
