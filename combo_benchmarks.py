import sys
import os
import time
import json
import itertools

# Insert backend root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from pqc import kyber, mceliece, fusion
from quantum import qrng
from crypto import aes

def measure_combo(algorithms):
    """
    Measures a specific combination of key algorithms.
    Expects a list of strings: ["kyber", "mceliece", "qrng"]
    """
    metrics = {
        "combo": " + ".join(algorithms),
        "keygen_ms": 0.0,
        "encap_ms": 0.0,
        "decap_ms": 0.0,
        "fusion_ms": 0.0,
        "total_latency_ms": 0.0,
        "total_pk_bytes": 0,
        "total_ct_bytes": 0,
    }

    pks = {}
    sks = {}
    cts = {}
    ss_encs = []
    ss_decs = []

    # 1. Keygen Phase
    t0 = time.perf_counter()
    if "kyber" in algorithms:
        pks["kyber"], sks["kyber"] = kyber.generate_keypair()
        metrics["total_pk_bytes"] += len(pks["kyber"])
    if "mceliece" in algorithms:
        pks["mceliece"], sks["mceliece"] = mceliece.generate_keypair()
        metrics["total_pk_bytes"] += len(pks["mceliece"])
    if "qrng" in algorithms:
        pass # QRNG doesn't have a public/private keypair in the traditional sense
    metrics["keygen_ms"] = (time.perf_counter() - t0) * 1000

    # 2. Encap Phase (Alice generating ciphertext and secrets)
    t0 = time.perf_counter()
    if "kyber" in algorithms:
        ct, ss = kyber.encapsulate(pks["kyber"])
        cts["kyber"] = ct
        ss_encs.append(ss)
        metrics["total_ct_bytes"] += len(ct)
    if "mceliece" in algorithms:
        ct, ss = mceliece.encapsulate(pks["mceliece"])
        cts["mceliece"] = ct
        ss_encs.append(ss)
        metrics["total_ct_bytes"] += len(ct)
    if "qrng" in algorithms:
        qrng_bytes = qrng.get_entropy_bytes()
        ss_encs.append(qrng_bytes)
        metrics["total_ct_bytes"] += 32 # 256 bits of entropy
    metrics["encap_ms"] = (time.perf_counter() - t0) * 1000

    # 3. Decap Phase (Bob recovering secrets)
    t0 = time.perf_counter()
    if "kyber" in algorithms:
        ss = kyber.decapsulate(cts["kyber"], sks["kyber"])
        ss_decs.append(ss)
    if "mceliece" in algorithms:
        ss = mceliece.decapsulate(cts["mceliece"], sks["mceliece"])
        ss_decs.append(ss)
    if "qrng" in algorithms:
        # Bob traditionally gets the QRNG seed via one of the KEMs or QKD.
        # For this fusion simulation, we assume he recovers the exact entropy bytes.
        ss_decs.append(ss_encs[-1]) 
    metrics["decap_ms"] = (time.perf_counter() - t0) * 1000

    # 4. Fusion Phase
    t0 = time.perf_counter()
    session_key_alice, salt = fusion.fuse_secrets(ss_encs)
    session_key_bob, _ = fusion.fuse_secrets(ss_decs, salt=salt)
    assert session_key_alice == session_key_bob
    metrics["fusion_ms"] = (time.perf_counter() - t0) * 1000

    metrics["total_latency_ms"] = metrics["keygen_ms"] + metrics["encap_ms"] + metrics["decap_ms"] + metrics["fusion_ms"]
    
    # round everything
    for k, v in metrics.items():
        if isinstance(v, float):
            metrics[k] = round(v, 3)

    return metrics

def run_combos():
    base_algs = ["kyber", "mceliece", "qrng"]
    combos = []
    
    # Generate all combinations of length 1 to 3
    for i in range(1, len(base_algs) + 1):
        for subset in itertools.combinations(base_algs, i):
            combos.append(list(subset))
            
    results = []
    print("Testing 7 combinations...")
    for c in combos:
        res = measure_combo(c)
        results.append(res)
        
    # Sort by total latency
    results.sort(key=lambda x: x["total_latency_ms"])
    
    # Print markdown table format
    print("| Combination | Latency (ms) | Keygen (ms) | Encap (ms) | Decap (ms) | PK Size (B) | CT Size (B) |")
    print("|---|---|---|---|---|---|---|")
    for r in results:
        print(f"| {r['combo']} | **{r['total_latency_ms']}** | {r['keygen_ms']} | {r['encap_ms']} | {r['decap_ms']} | {r['total_pk_bytes']} | {r['total_ct_bytes']} |")

if __name__ == "__main__":
    run_combos()
