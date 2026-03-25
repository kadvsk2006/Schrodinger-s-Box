# pyright: reportMissingImports=false
"""
routes/audit.py â€” Audit Log API

GET /api/audit/log                â†’ Return all audit events (newest first)
GET /api/audit/log?session_id=x  â†’ Filter by session
"""

from __future__ import annotations
from fastapi import APIRouter, Query
from core import audit

router = APIRouter(prefix="/api/audit", tags=["Audit Log"])


@router.get("/log")
async def get_audit_log(session_id: str | None = Query(default=None)):
    """Retrieve the cryptographic audit log, optionally filtered by session."""
    if session_id:
        events = audit.get_by_session(session_id)
    else:
        events = audit.get_all()
    return {"events": events, "count": len(events)}
