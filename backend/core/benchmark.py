# pyright: reportMissingImports=false
"""
benchmark.py â€” Performance benchmark suite for all PQC algorithms.

Measures:
- Key generation time (ms)
- Encapsulation / signing time (ms)
- Decapsulation / verification time (ms)
- Public key size (bytes)
- Private key size (bytes)
- Ciphertext / signature size (bytes)
- Memory delta (KB) if psutil is available

The results are returned as structured dicts for the frontend charts.
"""

from __future__ import annotations
import time
from typing import Any

try:
    import psutil  # type: ignore
    import os as _os
    _has_psutil = True
except ImportError:
    _has_psutil = False


def _memory_kb() -> float:
    """Return current process RSS in KB, or 0 if psutil is unavailable."""
    if not _has_psutil:
        return 0.0
    proc = psutil.Process(_os.getpid())
    return proc.memory_info().rss / 1024


def _b64len(b: bytes) -> int:
    return len(b)


def _round(val: float, ndigits: int) -> float:
    """Helper to bypass Pyre's strict typing on built-in round()."""
    return float(f"{val:.{ndigits}f}")


def benchmark_kyber(kyber_module: Any) -> dict:
    """Benchmark CRYSTALS-Kyber (KEM)."""
    results: dict = {"algorithm": "Kyber1024", "family": "Lattice-based", "type": "KEM"}

    # Key generation
    mem_before = _memory_kb()
    t0 = time.perf_counter()
    pk, sk = kyber_module.generate_keypair()
    results["keygen_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["memory_delta_kb"] = _round(_memory_kb() - mem_before, 2)
    results["public_key_bytes"] = _b64len(pk)
    results["private_key_bytes"] = _b64len(sk)

    # Encapsulation
    t0 = time.perf_counter()
    ct, ss_enc = kyber_module.encapsulate(pk)
    results["encap_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["ciphertext_bytes"] = _b64len(ct)

    # Decapsulation
    t0 = time.perf_counter()
    ss_dec = kyber_module.decapsulate(ct, sk)
    results["decap_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["shared_secret_match"] = ss_enc == ss_dec

    return results


def benchmark_mceliece(mceliece_module: Any) -> dict:
    """Benchmark Classic McEliece (KEM)."""
    results: dict = {"algorithm": "Classic-McEliece", "family": "Code-based", "type": "KEM"}

    mem_before = _memory_kb()
    t0 = time.perf_counter()
    pk, sk = mceliece_module.generate_keypair()
    results["keygen_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["memory_delta_kb"] = _round(_memory_kb() - mem_before, 2)
    results["public_key_bytes"] = _b64len(pk)
    results["private_key_bytes"] = _b64len(sk)

    t0 = time.perf_counter()
    ct, ss_enc = mceliece_module.encapsulate(pk)
    results["encap_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["ciphertext_bytes"] = _b64len(ct)

    t0 = time.perf_counter()
    ss_dec = mceliece_module.decapsulate(ct, sk)
    results["decap_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["shared_secret_match"] = ss_enc == ss_dec

    return results


def benchmark_sphincs(sphincs_module: Any) -> dict:
    """Benchmark SPHINCS+ (Signature)."""
    results: dict = {"algorithm": "SPHINCS+", "family": "Hash-based", "type": "Signature"}
    message = b"Benchmark test message for SPHINCS+ digital signature."

    mem_before = _memory_kb()
    t0 = time.perf_counter()
    pk, sk = sphincs_module.generate_keypair()
    results["keygen_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["memory_delta_kb"] = _round(_memory_kb() - mem_before, 2)
    results["public_key_bytes"] = _b64len(pk)
    results["private_key_bytes"] = _b64len(sk)

    t0 = time.perf_counter()
    sig = sphincs_module.sign(message, sk)
    results["sign_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["signature_bytes"] = _b64len(sig)

    t0 = time.perf_counter()
    valid = sphincs_module.verify(message, sig, pk)
    results["verify_ms"] = _round((time.perf_counter() - t0) * 1000, 3)
    results["signature_valid"] = valid

    return results


def run_full_benchmark() -> dict:
    """
    Import algorithm modules and run all benchmarks.
    Returns a dict with results for each algorithm + summary stats.
    """
    from pqc import kyber as kyber_mod          # type: ignore
    from pqc import mceliece as mceliece_mod    # type: ignore
    from pqc import sphincs as sphincs_mod      # type: ignore

    kyber_result = benchmark_kyber(kyber_mod)
    mceliece_result = benchmark_mceliece(mceliece_mod)
    sphincs_result = benchmark_sphincs(sphincs_mod)

    total_ms = (
        kyber_result["keygen_ms"]
        + mceliece_result["keygen_ms"]
        + sphincs_result["keygen_ms"]
    )

    return {
        "algorithms": [kyber_result, mceliece_result, sphincs_result],
        "summary": {
            "total_keygen_ms": _round(total_ms, 3),
            "total_public_key_bytes": (
                kyber_result["public_key_bytes"]
                + mceliece_result["public_key_bytes"]
                + sphincs_result["public_key_bytes"]
            ),
            "mode": kyber_mod.MODE,
        },
    }

if __name__ == "__main__":
    import sys
    import os
    import json
    # Ensure backend is in python path to allow direct script execution
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    print("Running cryptographic benchmarks, please wait...")
    res = run_full_benchmark()
    print(json.dumps(res, indent=2))

