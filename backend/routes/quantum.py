# pyright: reportMissingImports=false
"""
routes/quantum.py â€” Quantum Module API

GET  /api/quantum/qrng          â†’ Generate quantum random entropy
GET  /api/quantum/bb84          â†’ Run BB84 QKD simulation
GET  /api/quantum/bb84?eve=true â†’ Run BB84 with Eve interception
"""

from __future__ import annotations
from fastapi import APIRouter, Query
from quantum import qrng as qrng_mod, bb84 as bb84_mod
from core import audit

router = APIRouter(prefix="/api/quantum", tags=["Quantum Layer"])


@router.get("/qrng")
async def quantum_rng(bits: int = Query(default=256, ge=8, le=1024)):
    """
    Generate quantum random entropy using Hadamard circuits.

    Returns entropy bytes plus circuit metadata for visualization.
    """
    result = qrng_mod.generate_entropy(bits)
    audit.record(
        "QUANTUM_ENTROPY",
        algorithm="QRNG",
        detail=f"Generated {result['bits_generated']} bits via {result['mode']}",
    )
    return result


from pydantic import BaseModel  # type: ignore

class QasmRequest(BaseModel):
    qasm: str
    shots: int = 1024

@router.post("/simulate_qasm")
async def simulate_custom_qasm(req: QasmRequest):
    """
    Run an arbitrary OPENQASM 2.0 script on the quantum simulator.
    Returns the execution counts (probability distribution).
    """
    from quantum.qasm_sim import run_qasm  # type: ignore
    result = run_qasm(req.qasm, req.shots)
    audit.record(
        "QUANTUM_ENTROPY",  # Using generic quantum event
        algorithm="Custom-QASM",
        detail=f"Ran {result.get('qubits', '?')}-qubit custom circuit successfully: {result.get('success')}"
    )
    return result

@router.get("/bb84")
async def bb84_simulation(
    bits: int = Query(default=100, ge=20, le=500),
    eve: bool = Query(default=False, description="Inject Eve (eavesdropper)"),
):
    """
    Run a BB84 QKD simulation.

    With ?eve=true, injects an eavesdropper â€” QBER will rise above 11%
    signalling the interception.
    """
    result = bb84_mod.simulate(n_bits=bits, eve_present=eve)
    audit.record(
        "BB84_SIMULATION",
        algorithm="BB84",
        detail=(
            f"n={bits}, QBER={result['qber']:.2%}, "
            f"eve={'detected' if result['eve_detected'] else 'not detected'}"
        ),
    )
    return result
