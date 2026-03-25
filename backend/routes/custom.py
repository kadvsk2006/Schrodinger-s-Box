# pyright: reportMissingImports=false
import os
import time
import importlib
import re
import math
import os as _os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pqc import custom_algo
from core import audit
from crypto import aes

router = APIRouter(prefix="/api/custom", tags=["CustomAlgorithm"])

PAYLOAD_SIZES = [64, 1024, 8192, 65536]   # bytes: 64B, 1KB, 8KB, 64KB

def _round(v: float) -> float:
    return float(f"{v:.4f}")

class CustomAlgoRequest(BaseModel):
    code: str

@router.post("/register")
def register_algorithm(req: CustomAlgoRequest):
    """
    Overwrites the `pqc/custom_algo.py` file with the user's uploaded Python code,
    and dynamically reloads the module in memory so that it takes immediate effect
    for the Secure Chat encryption pipeline.
    """
    # Quick safety sanity check
    if "import os" in req.code or "import sys" in req.code or "subprocess" in req.code:
        raise HTTPException(status_code=400, detail="Arbitrary system imports are disabled for security.")
    
    if "def encrypt" not in req.code or "def decrypt" not in req.code:
        raise HTTPException(status_code=400, detail="Your Python code MUST contain 'def encrypt(key, plaintext)' and 'def decrypt(key, ciphertext)'.")

    if "ALGO_METADATA" not in req.code:
        raise HTTPException(status_code=400, detail="Your Python code MUST contain the ALGO_METADATA dictionary outlining its structure.")

    # ── Heuristic Analysis for Security Score ──
    code_text = req.code
    score = 85
    assessment = "Hybrid Kyber+McEliece secured"

    # Symmetric / Grover's vulnerability (XOR loops, bit manipulation)
    xor_loop = re.search(r'for.*in.*:\s+.*[\^&|]', code_text)
    bit_manip = len(re.findall(r'<<|>>|\^|&|\|', code_text)) > 5
    if xor_loop or bit_manip:
        score = 45
        assessment = "Vulnerable to Grover's Algorithm (Symmetric)"

    # Asymmetric / Shor's vulnerability (Modular arithmetic, exponentiation)
    modular_pow = re.search(r'pow\(.*,.*,.*\)|modpow|\*\*.*%', code_text)
    if modular_pow:
        score = 15
        assessment = "FATAL: Vulnerable to Shor's Algorithm (HSP)"

    # PQC / Lattice patterns
    matrix_math = re.search(r'np\.dot|linalg|matmul|@', code_text)
    modulo_q = re.search(r'%\s*[qQnNdk]', code_text)
    if matrix_math and modulo_q:
        score = 95
        assessment = "Quantum-Resistant (Lattice/Ring Structures Detected)"

    file_path = os.path.join("pqc", "custom_algo.py")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.code)
        importlib.reload(custom_algo)
        audit.record(
            "BYOA_REGISTER",
            session_id=None,
            algorithm="User Custom Module",
            detail=f"Uploaded new BYOA algorithm. Score: {score}/100."
        )
        return {
            "success": True, 
            "message": "Algorithm Successfully Compiled & Injected!",
            "security_score": score,
            "assessment": assessment
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/benchmark")
def benchmark_custom_algo():
    """
    Run encrypt/decrypt benchmarks on the currently loaded custom algorithm.
    Tests across multiple payload sizes and compares to AES-256-GCM baseline.
    """
    # Re-import to get the freshest version
    importlib.reload(custom_algo)

    if not hasattr(custom_algo, "encrypt") or not hasattr(custom_algo, "decrypt"):
        raise HTTPException(
            status_code=400,
            detail="No custom algorithm registered yet. Deploy one first via the BYOA Plugin."
        )

    # Use a fixed 256-bit key (32 bytes) — same as what Kyber-fusion produces
    key = _os.urandom(32)
    # Also generate a valid 32-byte key for the live AES baseline comparison
    aes_key = _os.urandom(32)
    
    results = []
    RUNS = 10  # average over this many runs for accuracy

    for size in PAYLOAD_SIZES:
        payload = _os.urandom(size)
        
        # Warm-up run (avoid JIT / import cost skewing first measurement)
        try:
            ct_warmup = custom_algo.encrypt(key, payload)
            custom_algo.decrypt(key, ct_warmup)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Algorithm error on {size}B payload: {e}")

        # ── Benchmark Custom Algorithm ──
        # Encrypt timing
        enc_times = []
        for _ in range(RUNS):
            t0 = time.perf_counter()
            ciphertext = custom_algo.encrypt(key, payload)
            enc_times.append((time.perf_counter() - t0) * 1000)

        # Decrypt timing
        dec_times = []
        decrypted = None
        for _ in range(RUNS):
            t0 = time.perf_counter()
            decrypted = custom_algo.decrypt(key, ciphertext)
            dec_times.append((time.perf_counter() - t0) * 1000)

        avg_enc = sum(enc_times) / RUNS
        avg_dec = sum(dec_times) / RUNS

        correct = decrypted == payload
        throughput_mbps = _round((size / (avg_enc / 1000)) / (1024 * 1024)) if avg_enc > 0 else 0

        # ── Benchmark Live AES-256-GCM Baseline ──
        aes_enc_times = []
        for _ in range(RUNS):
            t0 = time.perf_counter()
            aes_ct = aes.encrypt(payload, aes_key)
            aes_enc_times.append((time.perf_counter() - t0) * 1000)
            
        aes_dec_times = []
        for _ in range(RUNS):
            t0 = time.perf_counter()
            aes.decrypt(aes_ct, aes_key)
            aes_dec_times.append((time.perf_counter() - t0) * 1000)
            
        aes_avg_enc = sum(aes_enc_times) / RUNS
        aes_avg_dec = sum(aes_dec_times) / RUNS

        results.append({
            "payload_bytes": size,
            "payload_label": f"{size}B" if size < 1024 else f"{size // 1024}KB",
            "encrypt_ms": _round(avg_enc),
            "decrypt_ms": _round(avg_dec),
            "throughput_mbps": throughput_mbps,
            "ciphertext_bytes": len(ciphertext),
            "correct": correct,
            "vs_aes": {
                "encrypt_ratio": _round(avg_enc / aes_avg_enc) if aes_avg_enc else 0,
                "decrypt_ratio": _round(avg_dec / aes_avg_dec) if aes_avg_dec else 0,
            }
        })

    overall_correct = all(r["correct"] for r in results)
    
    # ── Security Evaluation Engine (Metadata + Runtime) ──
    meta = getattr(custom_algo, "ALGO_METADATA", {})
    algo_type = meta.get("type", "unknown")
    k_size = meta.get("key_size", 256)
    rounds = meta.get("rounds", 1)
    structure = meta.get("structure", "unknown")
    has_sbox = meta.get("has_sbox", False)
    q_claim = meta.get("quantum_safe_claim", False)

    # A. Shor Resistance
    if (algo_type in ["KEM", "asymmetric"]) and not q_claim:
        shor = "VULNERABLE"
    else:
        shor = "RESISTANT"

    # B. Grover Impact
    eff_q = k_size // 2
    grover = f"≈ {eff_q}-bit quantum security"

    # C. Classical Strength Heuristic
    if rounds >= 10 and has_sbox and structure in ["spn", "feistel"]:
        cls_str = "STRONG"
    elif rounds >= 6 and has_sbox:
        cls_str = "MODERATE"
    else:
        cls_str = "WEAK (Low rounds, no S-box)"

    # E. Harvest-Now-Decrypt-Later
    if algo_type == "KEM" and q_claim:
        harvest = "SAFE"
    else:
        harvest = "VULNERABLE to Harvest-Now-Decrypt-Later"

    # Runtime Tests (Avalanche & Entropy)
    test_key = _os.urandom(k_size // 8 if k_size > 0 else 32)
    test_pt = _os.urandom(128)
    try:
        ct_test = custom_algo.encrypt(test_key, test_pt)
        # Shannon Entropy
        ent = 0.0
        if len(ct_test) > 0:
            for x in range(256):
                p_x = float(ct_test.count(x)) / len(ct_test)
                if p_x > 0:
                    ent += - p_x * math.log2(p_x)  # type: ignore
        entropy_str = f"{ent:.2f} bits/byte"

        # Avalanche Effect (flip 1 bit)
        pt_flipped = bytearray(test_pt)
        pt_flipped[0] ^= 0x01
        ct_flipped = custom_algo.encrypt(test_key, bytes(pt_flipped))
        
        diff_bits = 0
        min_len = min(len(ct_test), len(ct_flipped))
        for i in range(min_len):
            diff_bits += bin(ct_test[i] ^ ct_flipped[i]).count("1")
        total_bits = min_len * 8
        avalanche_pct = (diff_bits / total_bits) * 100 if total_bits > 0 else 0
        avalanche_score = f"{avalanche_pct:.1f}%"
    except Exception:
        entropy_str = "N/A (Encryption Failed)"
        avalanche_pct = 0
        avalanche_score = "0.0%"

    # Final Score Check
    score_pts = 0
    if shor == "RESISTANT": score_pts += 2
    if cls_str == "STRONG": score_pts += 3
    elif cls_str == "MODERATE": score_pts += 1
    if ent > 7.5: score_pts += 2
    if 45 <= avalanche_pct <= 55: score_pts += 3
    elif 20 <= avalanche_pct <= 80: score_pts += 1

    audit.record(
        "BYOA_BENCHMARK",
        session_id=None,
        algorithm="User Custom Module",
        detail=f"Benchmark run across {len(PAYLOAD_SIZES)} payload sizes. Correctness: {overall_correct}"
    )

    return {
        "success": True,
        "results": results,
        "overall_correct": overall_correct,
        "summary": {
            "avg_encrypt_ms": _round(sum(float(r["encrypt_ms"]) for r in results) / len(results)) if results else 0, # type: ignore
            "avg_decrypt_ms": _round(sum(float(r["decrypt_ms"]) for r in results) / len(results)) if results else 0, # type: ignore
            "max_throughput_mbps": max(float(r["throughput_mbps"]) for r in results) if results else 0, # type: ignore
        },
        "evaluation": {
            "shor": shor,
            "grover": grover,
            "classical_strength": cls_str,
            "bruteforce": {
                "classical": f"2^{k_size}",
                "quantum": f"2^{eff_q}"
            },
            "harvest_attack": harvest,
            "avalanche_score": avalanche_score,
            "entropy": entropy_str,
            "final_score": f"{score_pts}/10"
        }
    }

