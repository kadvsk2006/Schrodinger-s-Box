# pyright: reportMissingImports=false
"""
session.py â€” In-memory session store for SchrÃ¶dinger's Box.

A "session" represents a complete cryptographic context:
- Public/private key pairs for each PQC algorithm
- The fused session key (AES-256)
- Algorithm metadata and status
- Security score (computed from which algorithms are active)
"""

from __future__ import annotations
import uuid
import threading
from datetime import datetime, timezone
from typing import Any


class Session:
    """
    Holds all state for one secure session.

    Attributes:
        session_id      Unique identifier (UUID4).
        created_at      ISO-8601 creation timestamp.
        kyber_keys      Dict with public_key, private_key (bytes, base64).
        mceliece_keys   Same structure for McEliece.
        sphincs_keys    Same structure for SPHINCS+.
        session_key     Derived 256-bit AES session key (bytes).
        quantum_entropy Entropy bytes contributed by the quantum layer.
        algorithms_used List of algorithm names active in this session.
        security_score  Integer 0â€“100 computed from active algorithms.
        messages        List of encrypted message records.
        mode            "simulation" | "real" depending on liboqs availability.
    """

    def __init__(self) -> None:
        self.session_id: str = str(uuid.uuid4())
        self.created_at: str = datetime.now(timezone.utc).isoformat()
        self.kyber_keys: dict[str, Any] = {}
        self.mceliece_keys: dict[str, Any] = {}
        self.sphincs_keys: dict[str, Any] = {}
        self.session_key: bytes | None = None
        self.quantum_entropy: bytes | None = None
        self.algorithms_used: list[str] = []
        self.security_score: int = 0
        self.messages: list[dict] = []
        self.mode: str = "simulation"  # updated by key generation

    def compute_security_score(self) -> int:
        """
        Score = base score per active algorithm family + quantum bonus.
        Max possible = 100.
        """
        score = 0
        if "Kyber1024" in self.algorithms_used or "ECDH-fallback" in self.algorithms_used:
            score += 30  # lattice / DH KEM
        if "Classic-McEliece" in self.algorithms_used or "RSA-OAEP-fallback" in self.algorithms_used:
            score += 30  # code-based KEM
        if "SPHINCS+" in self.algorithms_used or "Ed25519-fallback" in self.algorithms_used:
            score += 20  # signature
        if self.quantum_entropy is not None:
            score += 15  # quantum layer
        if self.mode == "real":
            score += 5   # genuine PQC bonus
        self.security_score = min(score, 100)
        return self.security_score

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "algorithms_used": self.algorithms_used,
            "security_score": self.security_score,
            "mode": self.mode,
            "has_session_key": self.session_key is not None,
            "has_quantum_entropy": self.quantum_entropy is not None,
            "message_count": len(self.messages),
        }


# â”€â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_lock = threading.Lock()
_sessions: dict[str, Session] = {}


def create() -> Session:
    sess = Session()
    with _lock:
        _sessions[sess.session_id] = sess
    return sess


def get(session_id: str) -> Session | None:
    with _lock:
        return _sessions.get(session_id)


def get_or_raise(session_id: str) -> Session:
    sess = get(session_id)
    if sess is None:
        raise KeyError(f"Session '{session_id}' not found.")
    return sess


def delete(session_id: str) -> bool:
    with _lock:
        return _sessions.pop(session_id, None) is not None


def all_sessions() -> list[dict]:
    with _lock:
        return [s.to_dict() for s in _sessions.values()]
