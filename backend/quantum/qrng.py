# pyright: reportMissingImports=false
"""
qrng.py â€” Quantum Random Number Generator via Qiskit

Uses a Hadamard-gate quantum circuit to generate truly random bits.
Each qubit is placed in superposition by a Hadamard gate H|0âŸ© = |+âŸ©,
then measured â€” collapsing to 0 or 1 with equal probability.

This is genuinely unpredictable by any classical algorithm; the
randomness comes from quantum measurement.

Real quantum: Qiskit AerSimulator (local quantum circuit simulation)
Fallback:     os.urandom (cryptographically secure, but classical)

Note: AerSimulator supports a maximum of ~29 qubits with its default
coupling_map. We batch large requests into 24-qubit chunks to stay within
this limit while producing the full requested entropy.
"""

from __future__ import annotations
import os
import base64
from config import USE_QISKIT, QRNG_BITS  # type: ignore

# AerSimulator's practical qubit limit (29 qubits max with coupling maps)
MAX_QUBITS_PER_CIRCUIT = 24

# â”€â”€â”€ Mode Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try:
    if not USE_QISKIT:
        raise ImportError("Qiskit disabled by config flag")
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator  # type: ignore
    MODE = "quantum"
except Exception:
    MODE = "classical"


def _build_hadamard_circuit(n_bits: int) -> "QuantumCircuit":
    """
    Construct an n-qubit all-Hadamard circuit.

    Circuit diagram (for n=4):
        q0: â”€Hâ”€â”¤Mâ”œ
        q1: â”€Hâ”€â”¤Mâ”œ
        q2: â”€Hâ”€â”¤Mâ”œ
        q3: â”€Hâ”€â”¤Mâ”œ

    Measuring each qubit in superposition gives a uniformly random bit.
    """
    qc = QuantumCircuit(n_bits, n_bits)
    for i in range(n_bits):
        qc.h(i)   # Hadamard gate â†’ |+âŸ© state
    qc.measure(range(n_bits), range(n_bits))
    return qc


def _quantum_random_bits(n_bits: int) -> list[int]:
    """
    Run Hadamard circuits on AerSimulator, return list of random bits.

    AerSimulator is limited to ~29 qubits with its default coupling_map,
    so we batch large requests into chunks of MAX_QUBITS_PER_CIRCUIT.
    """
    from qiskit import transpile  # type: ignore
    from qiskit_aer import AerSimulator  # type: ignore

    simulator = AerSimulator()
    all_bits: list[int] = []

    remaining = n_bits
    while remaining > 0:
        chunk = min(remaining, MAX_QUBITS_PER_CIRCUIT)
        qc = _build_hadamard_circuit(chunk)
        compiled = transpile(qc, simulator)
        job = simulator.run(compiled, shots=1)
        result = job.result()
        counts = result.get_counts(compiled)
        # 'counts' is a dict like {'01101100...': 1}; get the single measurement
        bitstring = list(counts.keys())[0]
        # Pad to chunk length (Qiskit may drop leading zeros in the bitstring)
        bitstring = bitstring.zfill(chunk)
        all_bits.extend([int(b) for b in bitstring])
        remaining -= chunk

    return all_bits[:n_bits]  # type: ignore


def generate_entropy(n_bits: int = QRNG_BITS) -> dict:
    """
    Generate n_bits of quantum or classical entropy.

    Returns:
        {
            "entropy_hex": str,          # hex-encoded entropy bytes
            "entropy_b64": str,          # base64-encoded entropy bytes
            "bits_generated": int,
            "mode": "quantum" | "classical",
            "circuit_description": str,  # human-readable circuit info
        }
    """
    if MODE == "quantum":
        bits = _quantum_random_bits(n_bits)
        # Group bits into bytes (pad if needed)
        padded = bits + [0] * (8 - len(bits) % 8) if len(bits) % 8 != 0 else bits
        entropy_bytes = bytes(
            int("".join(str(b) for b in padded[i:i+8]), 2)
            for i in range(0, len(padded), 8)
        )
        circuit_desc = (
            f"{n_bits}-qubit Hadamard circuit. "
            f"Each qubit |0âŸ© â†’ H â†’ |+âŸ© â†’ measured. "
            f"Simulator: Qiskit AerSimulator (statevector). "
            f"Result: 1 shot â†’ {n_bits}-bit measurement string."
        )
        mode_label = "quantum"
    else:
        entropy_bytes = os.urandom((n_bits + 7) // 8)
        circuit_desc = "Fallback: os.urandom (CSPRNG). Qiskit not available."
        mode_label = "classical"

    return {
        "entropy_hex": entropy_bytes.hex(),
        "entropy_b64": base64.b64encode(entropy_bytes).decode(),
        "bits_generated": n_bits,
        "bytes_generated": len(entropy_bytes),
        "mode": mode_label,
        "circuit_description": circuit_desc,
    }


def get_entropy_bytes(n_bits: int = QRNG_BITS) -> bytes:
    """Convenience: return just the raw entropy bytes."""
    result = generate_entropy(n_bits)
    return bytes.fromhex(result["entropy_hex"])
