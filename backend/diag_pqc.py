
import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

try:
    from pqc import kyber, mceliece
    print(f"Kyber Mode: {kyber.MODE}")
    print(f"McEliece Mode: {mceliece.MODE}")
    
    pk, sk = kyber.generate_keypair()
    print("Kyber keygen success")
    
    pk2, sk2 = mceliece.generate_keypair()
    print("McEliece keygen success")
    
    print("DIAGNOSTIC_SUCCESS")
except Exception as e:
    print(f"DIAGNOSTIC_FAILURE: {e}")
    import traceback
    traceback.print_exc()
