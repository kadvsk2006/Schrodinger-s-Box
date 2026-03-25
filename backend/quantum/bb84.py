# pyright: reportMissingImports=false
"""
bb84.py â€” BB84 Quantum Key Distribution Protocol Simulation

Simulates the BB84 QKD protocol using Qiskit circuits.

BB84 Protocol Summary:
  1. Alice generates random bits and random bases {+, Ã—}.
  2. Alice encodes each bit as a qubit in her chosen basis.
  3. Bob measures each qubit in a randomly chosen basis.
  4. Alice and Bob announce their bases (over a public channel).
  5. They keep only bits where bases matched â†’ "sifted key".
  6. QBER (Quantum Bit Error Rate) = fraction of errors in a sample.
     If QBER > 11%, eavesdropping is detected (Eve disturbs the channel).

This simulation models an idealised noiseless channel, so QBER â‰ˆ 0
unless we inject simulated Eve.
"""

from __future__ import annotations
import os
import random
import base64
from config import USE_QISKIT, BB84_BITS

try:
    if not USE_QISKIT:
        raise ImportError("Qiskit disabled")
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import AerSimulator  # type: ignore
    MODE = "quantum"
except Exception:
    MODE = "classical"


def _encode_qubit(bit: int, basis: str) -> "QuantumCircuit":
    """
    Create a 1-qubit circuit encoding `bit` in `basis`.
      basis '+' (rectilinear): |0âŸ© or |1âŸ©
      basis 'Ã—' (diagonal):   |+âŸ© or |âˆ’âŸ©
    """
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(1, 1)
    if bit == 1:
        qc.x(0)          # flip to |1âŸ©
    if basis == "Ã—":
        qc.h(0)          # rotate to diagonal basis
    return qc


def _measure_qubit(qc: "QuantumCircuit", basis: str) -> "QuantumCircuit":
    """Add measurement in the given basis."""
    if basis == "Ã—":
        qc.h(0)          # rotate back before measuring
    qc.measure(0, 0)
    return qc


def simulate(n_bits: int = BB84_BITS, eve_present: bool = False) -> dict:
    """
    Run a full BB84 simulation.

    Args:
        n_bits:      Number of qubits Alice sends.
        eve_present: If True, inject Eve who intercepts and re-sends.

    Returns rich dict with all protocol metadata for the frontend dashboard.
    """
    # â”€â”€ Step 1: Alice generates random bits and bases
    alice_bits   = [random.randint(0, 1) for _ in range(n_bits)]
    alice_bases  = [random.choice(["+", "Ã—"]) for _ in range(n_bits)]

    # â”€â”€ Step 2: Bob chooses random bases
    bob_bases    = [random.choice(["+", "Ã—"]) for _ in range(n_bits)]

    # â”€â”€ Step 3: Simulate transmission + measurement
    bob_results: list[int] = []

    if MODE == "quantum":
        simulator = AerSimulator()
        for i in range(n_bits):
            qc = _encode_qubit(alice_bits[i], alice_bases[i])

            # Eve intercept (optional): measure in random basis, re-encode
            if eve_present:
                eve_basis = random.choice(["+", "Ã—"])
                qc_eve = _measure_qubit(qc.copy(), eve_basis)
                compiled = transpile(qc_eve, simulator)
                res = simulator.run(compiled, shots=1).result()
                eve_bit = int(list(res.get_counts().keys())[0])
                qc = _encode_qubit(eve_bit, eve_basis)

            qc_meas = _measure_qubit(qc, bob_bases[i])
            compiled = transpile(qc_meas, simulator)
            res = simulator.run(compiled, shots=1).result()
            bob_results.append(int(list(res.get_counts().keys())[0]))
    else:
        # Pure classical simulation of the same protocol
        for i in range(n_bits):
            if eve_present:
                # Eve intercepts EVERY photon (not just 50%)
                eve_basis = random.choice(["+", "Ã—"])
                eve_bit   = alice_bits[i] if eve_basis == alice_bases[i] else random.randint(0, 1)
                bit = eve_bit if (eve_basis == bob_bases[i]) else random.randint(0, 1)
            else:
                bit = alice_bits[i] if (alice_bases[i] == bob_bases[i]) else random.randint(0, 1)
            bob_results.append(bit)

    # â”€â”€ Step 4: Sifting â€” keep bits where bases matched
    sifted_alice = [alice_bits[i]  for i in range(n_bits) if alice_bases[i] == bob_bases[i]]
    sifted_bob   = [bob_results[i] for i in range(n_bits) if alice_bases[i] == bob_bases[i]]

    # â”€â”€ Step 5: Compute QBER on first half of sifted key
    check_sample = max(1, len(sifted_alice) // 4)
    errors = sum(
        1 for i in range(check_sample)
        if sifted_alice[i] != sifted_bob[i]
    )
    qber = round(errors / check_sample, 4) if check_sample > 0 else 0.0

    # Final shared key = second half of sifted key (unused by QBER check)
    shared_key_bits = sifted_bob[check_sample:]
    shared_key_bytes = bytes(
        int("".join(str(b) for b in shared_key_bits[i:i+8]), 2)
        for i in range(0, len(shared_key_bits) - len(shared_key_bits) % 8, 8)
    )

    return {
        "n_bits_transmitted": n_bits,
        "sifted_key_length": len(sifted_alice),
        "final_key_length_bits": len(shared_key_bits) - len(shared_key_bits) % 8,
        "qber": qber,
        "eve_detected": qber > 0.20,  # Theoretical BB84 threshold: Eve causes ~25% QBER
        "eve_present": eve_present,
        "shared_key_b64": base64.b64encode(shared_key_bytes).decode() if shared_key_bytes else "",
        "shared_key_bytes": len(shared_key_bytes),
        "mode": MODE,
        "protocol": "BB84",
        # Preview for visualisation: show the first 20 *transmitted* bits so the
        # UI can display both matched and mismatched basis rows clearly.
        "alice_bits_preview":  alice_bits[:20],
        "alice_bases_preview": alice_bases[:20],
        "bob_bases_preview":   bob_bases[:20],
        "bob_results_preview": bob_results[:20],
        "basis_match_preview": [alice_bases[i] == bob_bases[i] for i in range(20)],
        # Sifted-only preview (first 16 bits where bases matched) for the compact table
        "sifted_preview": [
            {"bit": sifted_alice[i], "bob": sifted_bob[i], "match": sifted_alice[i] == sifted_bob[i]}
            for i in range(min(16, len(sifted_alice)))
        ],
    }
