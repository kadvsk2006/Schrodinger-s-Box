# pyright: reportMissingImports=false
"""
audit.py â€” Append-only, in-memory audit log for all cryptographic events.

Every time a key is generated, a message is encrypted/decrypted, or a
signature is made/verified, this module records the event. The log is
accessible via the /api/audit/log endpoint.
"""

from __future__ import annotations
import threading
from datetime import datetime, timezone
from typing import Literal
from collections import deque
from config import MAX_AUDIT_EVENTS  # type: ignore

# â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
EventType = Literal[
    "KEY_GENERATION",
    "KEY_ENCAPSULATION",
    "KEY_DECAPSULATION",
    "ENCRYPT",
    "DECRYPT",
    "SIGN",
    "VERIFY",
    "QUANTUM_ENTROPY",
    "BB84_SIMULATION",
    "BENCHMARK",
    "SESSION_CREATED",
    "SESSION_CLOSED",
    "ERROR",
]


class AuditEvent:
    """Represents a single immutable audit record."""

    def __init__(
        self,
        event_type: EventType,
        session_id: str | None = None,
        algorithm: str | None = None,
        detail: str = "",
        success: bool = True,
    ) -> None:
        self.timestamp: str = datetime.now(timezone.utc).isoformat()
        self.event_type: EventType = event_type
        self.session_id: str | None = session_id
        self.algorithm: str | None = algorithm
        self.detail: str = detail
        self.success: bool = success

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "session_id": self.session_id,
            "algorithm": self.algorithm,
            "detail": self.detail,
            "success": self.success,
        }


# â”€â”€â”€ Log Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_lock = threading.Lock()
_log: deque[AuditEvent] = deque(maxlen=MAX_AUDIT_EVENTS)


def record(
    event_type: EventType,
    session_id: str | None = None,
    algorithm: str | None = None,
    detail: str = "",
    success: bool = True,
) -> AuditEvent:
    """Append a new event to the audit log and return it."""
    event = AuditEvent(
        event_type=event_type,
        session_id=session_id,
        algorithm=algorithm,
        detail=detail,
        success=success,
    )
    with _lock:
        _log.append(event)
    return event


def get_all() -> list[dict]:
    """Return all audit events as a list of dicts (newest first)."""
    with _lock:
        return [e.to_dict() for e in reversed(_log)]


def get_by_session(session_id: str) -> list[dict]:
    """Return audit events for a specific session (newest first)."""
    with _lock:
        return [
            e.to_dict()
            for e in reversed(_log)
            if e.session_id == session_id
        ]
