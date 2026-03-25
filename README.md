# Schrödinger's Box 🔐⚛️

> **The definitive production-grade, quantum-safe secure communication platform.** Combining CRYSTALS-Kyber, Classic McEliece, SPHINCS+, AES-256-GCM, HKDF, and Qiskit-based quantum randomness. Designed for a post-quantum world.

![Schrödinger's Box Interface](frontend/public/favicon.svg)

---

## 🔥 Key Features

### 1. **Post-Quantum Cryptography Suite**
- **Key Encapsulation (KEM):** NIST-standardized **CRYSTALS-Kyber (Kyber1024)** and mature **Classic McEliece**.  
- **Digital Signatures:** Stateless hash-based **SPHINCS+** for quantum-resistant message authentication.
- **Quantum Randomness:** Integration with **IBM Qiskit** to generate genuine quantum entropy (QRNG) via Hadamard gates and BB84 protocol simulation.

### 2. **Advanced Tunnel & E2E Encrypted Audio 🎙️**
- **Client-Side Crypto:** True End-to-End Encryption entirely inside the browser using the Web Crypto API. The server *never* sees plaintext text or raw audio bytes.
- **E2E Audio:** Record via microphone or upload `.wav`/`.mp3` files. Encrypted instantly with a unique **AES-256-GCM** session key and random IV.
- **Encryption Proof Panel:** A visual faculty-validation panel that exposes the raw AES-256 key, IV, and a hex dump of the ciphertext *before* sending, proving the zero-knowledge architecture.

### 3. **Quantum Steganography (Q-Steg) 🖼️**
- Hide encrypted AES-256 ciphertext inside the Least Significant Bits (LSB) of standard `.png` or `.jpeg` images.
- Images act as secret carriers for text payloads, creating a covert channel that bypasses DPI (Deep Packet Inspection). The LSB dispersion is seeded by quantum entropy.

### 4. **Out-of-Band Manual Node Connection 🌐**
- Eliminate single points of failure. Users can manually connect to known peer nodes via direct WebSockets/IPs using an out-of-band shared connection code.
- Fully decentralized node registry that bypasses central authentication servers when required.

### 5. **Hybrid Fallback Systems**
- **Seamless Degradation:** If `liboqs` C-bindings are unavailable on the host OS, the system seamlessly falls back to classical equivalents (ECDH-P256, Ed25519, RSA-OAEP) to maintain uninterrupted service while prominently warning the user.

---

## 🚀 Quick Start

### Backend (Python 3.10+)

```bash
cd backend
pip install fastapi uvicorn[standard] python-multipart cryptography python-dotenv pydantic psutil qiskit qiskit-aer pylatexenc

# Optional (real PQC — requires system build tools):
pip install liboqs-python

# Start server
python main.py
# → http://localhost:8000
# → http://localhost:8000/docs  (interactive API docs)
```

### Frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🏗️ Architecture & Session Flow

1. **Key Exchange (`POST /api/keys/generate`)**: Generates Kyber + McEliece + SPHINCS+ keys in parallel threads.
2. **Encapsulation**: 
   - Kyber encaps → `shared_secret_1`
   - McEliece encaps → `shared_secret_2`
3. **Quantum Entropy**: Qiskit QRNG → `quantum_entropy` (`shared_secret_3`)
4. **Key Derivation**: `HKDF-SHA256(SS1 ‖ SS2 ‖ entropy)` → 256-bit symmetric session key.
5. **Transport**: `POST /api/messages/send` → AES-256-GCM ciphertext + SPHINCS+ signature sent to peer.
6. **Delivery**: Sync loop triggers browser decryption using the Web Crypto API.

## 🛠️ Modes matrix

| Library     | Available? | Algorithm Actively Used              |
|-------------|------------|--------------------------------------|
| liboqs      | ✅ Yes     | Real Kyber1024, McEliece, SPHINCS+ |
| liboqs      | ❌ No      | ECDH-P256, RSA-OAEP-4096, Ed25519 (Simulation) |
| Qiskit      | ✅ Yes     | Hadamard QRNG + BB84 circuits |
| Qiskit      | ❌ No      | os.urandom (Classical fallback) |

## 💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **React 18** + **TypeScript** + **Vite** |
| Animations/UI | Vanilla CSS (glassmorphism dark purple theme), Lucide Icons |
| Backend | **FastAPI** + **Uvicorn** (Python) |
| PQC Core | **liboqs-python** (Kyber, McEliece, SPHINCS+) |
| Audio/Crypto | **Web Crypto API**, MediaRecorder API |
| Symmetric | **AES-256-GCM** (python `cryptography` + WebCrypto) |
| Quantum | **Qiskit** + **Qiskit-Aer** local simulators |
