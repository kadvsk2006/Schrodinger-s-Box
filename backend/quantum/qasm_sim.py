# pyright: reportMissingImports=false
"""
qasm_sim.py — Quantum Threat Sandbox (Arbitrary Circuit execution)

Allows executing raw OPENQASM 2.0 strings on Qiskit's AerSimulator.
Used for the frontend Quantum Lab where judges can simulate quantum algorithms 
(like a 2-qubit Grover search) natively in their browser.
"""

from __future__ import annotations
from typing import Dict, Any
from config import USE_QISKIT  # type: ignore

try:
    if not USE_QISKIT:
        raise ImportError("Qiskit disabled by config flag")
    from qiskit import QuantumCircuit, transpile  # type: ignore
    from qiskit_aer import AerSimulator  # type: ignore
    MODE = "quantum"
except Exception:
    MODE = "simulation"


def run_qasm(qasm_string: str, shots: int = 1024) -> Dict[str, Any]:
    """
    Parses an OPENQASM 2.0 string, compiles it, and runs it on the local simulator.
    Returns the measurement counts and the parsed circuit structure.
    """
    if MODE == "simulation":
        return {
            "success": False,
            "error": "Qiskit is not available. Ensure USE_QISKIT=True and qiskit/qiskit-aer are installed.",
        }

    try:
        # Load circuit from QASM
        qc = QuantumCircuit.from_qasm_str(qasm_string)
        
        # Simulator
        simulator = AerSimulator()
        compiled_circuit = transpile(qc, simulator)
        
        # Execute
        job = simulator.run(compiled_circuit, shots=shots)
        result = job.result()
        counts = result.get_counts(compiled_circuit)
        
        return {
            "success": True,
            "counts": counts,
            "shots": shots,
            "qubits": qc.num_qubits,
            "depth": qc.depth(),
            "mode": "Qiskit AerSimulator (Statevector)"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
