# pyright: reportMissingImports=false
"""
routes/benchmark.py â€” Algorithm Benchmarking API

GET /api/benchmark/run
  Runs the full PQC benchmark suite and returns structured timing + size data.
"""

from __future__ import annotations
import os
import re
from fastapi import APIRouter, HTTPException
from core import benchmark, audit
from pqc import custom_algo

router = APIRouter(prefix="/api/benchmark", tags=["Benchmarking"])


@router.get("/run")
async def run_benchmark():
    """
    Run the full benchmark suite for all PQC algorithms.
    Returns timing (ms), key sizes (bytes), ciphertext sizes,
    and a dynamic attack simulation matrix including the BYOA plugin.
    """
    try:
        results = benchmark.run_full_benchmark()
        
        # ── Dynamic BYOA Attack Simulation ──
        # Default fallback (if no custom algo is uploaded or it is secure)
        custom_shors = '✓ Resistant'
        custom_grovers = '✓ Halved (L5)'
        custom_color = 'green'
        
        # Read the live custom_algo.py file
        file_path = os.path.join("pqc", "custom_algo.py")
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                code_text = f.read()
                
            # If default file text is untouched, label it N/A
            if "Bring Your Own Algorithm (BYOA) Plugin" in code_text and "zip(plaintext, key_cycle)" in code_text:
                custom_shors = '✗ Vulnerable'
                custom_grovers = '✗ Vulnerable'
                custom_color = 'amber'
            else:
                # Symmetric / Grover's vulnerability (XOR loops, bit manipulation)
                xor_loop = re.search(r'for.*in.*:\s+.*[\^&|]', code_text)
                bit_manip = len(re.findall(r'<<|>>|\^|&|\|', code_text)) > 5
                if xor_loop or bit_manip:
                    custom_grovers = '✗ Vulnerable (Symmetric)'
                    custom_color = 'amber'

                # Asymmetric / Shor's vulnerability (Modular arithmetic, exponentiation)
                modular_pow = re.search(r'pow\(.*,.*,.*\)|modpow|\*\*.*%', code_text)
                if modular_pow:
                    custom_shors = '✗ FATAL (HSP)'
                    custom_color = 'red'

                # PQC / Lattice patterns
                matrix_math = re.search(r'np\.dot|linalg|matmul|@', code_text)
                modulo_q = re.search(r'%\s*[qQnNdk]', code_text)
                if matrix_math and modulo_q:
                    custom_shors = '✓ Resistant'
                    custom_grovers = '✓ Halved'
                    custom_color = 'green'

        attack_matrix = [
            {"name": "Shor's Algorithm (HSP)", "kyber": "✓ Resistant", "mc": "✓ Resistant", "sp": "✓ Resistant", "custom": custom_shors, "kyber_color": "green", "custom_color": custom_color if "FATAL" in custom_shors else ("amber" if "Vulnerable" in custom_shors else "green")},
            {"name": "Grover's Algorithm", "kyber": "✓ Halved (L5)", "mc": "✓ Halved", "sp": "✓ Halved", "custom": custom_grovers, "kyber_color": "amber", "custom_color": "red" if "FATAL" in custom_grovers else ("amber" if "Vulnerable" in custom_grovers else "green")},
            {"name": "RSA / ECC Break", "kyber": "✓ Immune", "mc": "✓ Immune", "sp": "✓ Immune", "custom": custom_shors, "kyber_color": "green", "custom_color": "red" if "FATAL" in custom_shors else ("amber" if "Vulnerable" in custom_shors else "green")},
            {"name": "Harvest-Now-Decrypt-Later", "kyber": "✓ Safe", "mc": "✓ Safe", "sp": "✓ Safe", "custom": "✗ Vulnerable" if ("Vulnerable" in custom_shors or "Vulnerable" in custom_grovers) else "✓ Safe", "kyber_color": "green", "custom_color": "red" if ("Vulnerable" in custom_shors or "Vulnerable" in custom_grovers) else "green"},
            {"name": "Brute Force KEM", "kyber": "✓ 2¹⁸⁰ ops", "mc": "✓ 2¹²⁸ ops", "sp": "N/A", "custom": "✗ < 2¹²⁸ ops" if "Vulnerable" in custom_grovers else "✓ 2²⁵⁶ ops", "kyber_color": "cyan", "custom_color": "amber" if "Vulnerable" in custom_grovers else "cyan"},
            {"name": "Hash Pre-image Attack", "kyber": "N/A", "mc": "N/A", "sp": "✓ SHA2 secure", "custom": "N/A", "kyber_color": "cyan", "custom_color": "cyan"},
        ]

        results["attack_simulation"] = attack_matrix
        audit.record("BENCHMARK", detail=f"Benchmark complete. Mode: {results['summary']['mode']}")
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {e}")
