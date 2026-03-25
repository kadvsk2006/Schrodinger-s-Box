# pyright: reportMissingImports=false
"""
config.py â€” Centralised configuration for SchrÃ¶dinger's Box backend.

All tuneable parameters, feature flags, and algorithm metadata live here
so the rest of the codebase never has magic strings.
"""

from __future__ import annotations
import os
from dotenv import load_dotenv  # type: ignore

load_dotenv()

# â”€â”€â”€ Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174").split(",")

# â”€â”€â”€ Feature Flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Set USE_LIBOQS=false to force simulation fallback even if liboqs is installed.
USE_LIBOQS: bool = os.getenv("USE_LIBOQS", "true").lower() == "true"
USE_QISKIT: bool = os.getenv("USE_QISKIT", "true").lower() == "true"

# â”€â”€â”€ PQC Algorithm Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# These names map directly to liboqs algorithm identifiers.
PQC_ALGORITHMS: dict[str, dict] = {
    "kyber": {
        "liboqs_kem_name": "Kyber1024",
        "family": "Lattice-based (CRYSTALS-Kyber)",
        "security_level": 5,          # NIST level
        "type": "KEM",
        "description": (
            "Module-Learning With Errors (M-LWE) based KEM. "
            "NIST PQC Round 3 winner. Provides IND-CCA2 security."
        ),
    },
    "mceliece": {
        "liboqs_kem_name": "Classic-McEliece-348864",
        "family": "Code-based (Classic McEliece)",
        "security_level": 1,
        "type": "KEM",
        "description": (
            "Goppa code-based KEM. Extremely conservative security "
            "assumptions, large public keys (~261 KB)."
        ),
    },
    "sphincs": {
        "liboqs_sig_name": "SPHINCS+-SHA2-256f-simple",
        "family": "Hash-based (SPHINCS+)",
        "security_level": 5,
        "type": "Signature",
        "description": (
            "Stateless hash-based digital signature scheme. "
            "NIST PQC Round 3 alternate. No secret state to manage."
        ),
    },
}

# â”€â”€â”€ Cryptographic Parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
AES_KEY_BITS: int = 256          # AES-256-GCM
HKDF_HASH: str = "SHA256"
HKDF_INFO: bytes = b"schrodingers-box-v1-session-key"
SESSION_KEY_LENGTH: int = 32     # bytes â†’ 256-bit AES key

# â”€â”€â”€ Quantum Parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
QRNG_BITS: int = 256             # bits of quantum randomness per call
BB84_BITS: int = 100             # number of qubits in BB84 simulation

# â”€â”€â”€ Audit Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
MAX_AUDIT_EVENTS: int = 1000     # rolling window of audit events kept in memory
