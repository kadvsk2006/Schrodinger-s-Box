# pyright: reportMissingImports=false
"""
main.py â€” FastAPI Application Entrypoint for SchrÃ¶dinger's Box

Registers all routers, configures CORS, and starts the Uvicorn server.
"""

from __future__ import annotations
import sys
import os

# Make sure sibling packages (pqc, quantum, crypto, core, routes) are importable
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
import uvicorn

from config import HOST, PORT, CORS_ORIGINS  # type: ignore
from routes import keys, messages, benchmark, quantum, stego, analyzer, custom, auth, users, messenger, audit as audit_route, visualizer  # type: ignore
from database import engine
import models

# Initialize the SQLAlchemy Database Schema
models.Base.metadata.create_all(bind=engine)

# â”€â”€â”€ Application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app = FastAPI(
    title="Schrödinger's Box API",
    description=(
        "Hybrid quantum-safe secure communication platform. "
        "Combines CRYSTALS-Kyber, Classic McEliece, SPHINCS+, AES-256-GCM, "
        "HKDF, and Qiskit-based quantum randomness."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Rate Limiting ──────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# â”€â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Quantum-Seed"],
)

# â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.include_router(keys.router)
app.include_router(messages.router)
app.include_router(benchmark.router)
app.include_router(quantum.router)
app.include_router(stego.router)
app.include_router(analyzer.router)
app.include_router(custom.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(messenger.router)
app.include_router(audit_route.router)
app.include_router(visualizer.router)


@app.get("/api/status", tags=["Health"])
async def status():
    """Health check â€” returns server status and active mode."""
    from pqc import kyber, sphincs  # type: ignore
    from quantum import qrng  # type: ignore
    return {
        "service": "SchrÃ¶dinger's Box",
        "status": "operational",
        "pqc_mode": kyber.MODE,
        "quantum_mode": qrng.MODE,
        "algorithms": ["Kyber1024", "Classic-McEliece-348864", "SPHINCS+-SHA2-256f-simple"],
        "encryption": "AES-256-GCM",
        "key_derivation": "HKDF-SHA256",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}

# ─── Frontend SPA Serving ────────────────────────────────────────────────────
dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(dist_path):
    # Serve compiled static assets
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    # Catch-all route to serve the SPA for React Router paths
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc"):
            # Don't hijack valid but missing API requests
            raise HTTPException(status_code=404, detail="Route not found")
        
        # Check if they directly requested an existing file (like favicon.ico or manifest.json)
        file_path = os.path.join(dist_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback to index.html for client-side routing
        index_file = os.path.join(dist_path, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Index file not found. Have you run 'npm run build'?")


# â”€â”€â”€ Dev Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
