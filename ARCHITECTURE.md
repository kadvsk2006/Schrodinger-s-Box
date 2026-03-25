# Schrödinger's Box — System Architecture

> A hybrid post-quantum secure communication platform combining lattice-based KEM,
> code-based KEM, hash-based signatures, HKDF key fusion, and Qiskit quantum entropy.

---

## Table of Contents
1. [High-Level Overview](#1-high-level-overview)
2. [Component Breakdown](#2-component-breakdown)
3. [Cryptographic Protocol Flow](#3-cryptographic-protocol-flow)
4. [Key Exchange (KEM) Architecture](#4-key-exchange-kem-architecture)
5. [WebSocket Messenger Architecture](#5-websocket-messenger-architecture)
6. [Algorithm Stack](#6-algorithm-stack)
7. [Backend Module Tree](#7-backend-module-tree)
8. [Frontend Module Tree](#8-frontend-module-tree)
9. [API Surface](#9-api-surface)
10. [Security Properties](#10-security-properties)
11. [Threat Model](#11-threat-model)
12. [Data Flow Diagram](#12-data-flow-diagram)
13. [Deployment Architecture](#13-deployment-architecture)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser)                              │
│  React 18 + TypeScript + Vite                  :5173                │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │ Messenger│ │ThreatIntel│ │ Benchmarks│ │  BYOA Plugin         │  │
│  │ (E2E)    │ │(AST+QASM) │ │ Analytics │ │  (Custom Algorithms) │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────────────────┘  │
│         │                                                           │
│    AuthContext (JWT) + API Client (fetch + WebSocket)               │
└─────────────────────────────────────────────────────────────────────┘
          │  HTTP /api/*  (Vite proxy → :8000)
          │  ws://.../api/messenger/ws
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVER (FastAPI)                              │
│  Python 3.10+ + Uvicorn + SQLAlchemy            :8000               │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │ /api/auth│ │/api/      │ │/api/bench-│ │  /api/quantum/*      │  │
│  │ (JWT)    │ │messenger  │ │mark/*     │ │  (QRNG, BB84, QASM)  │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    PQC Engine                                  │ │
│  │  Kyber-1024  │  Classic-McEliece-8192  │  SPHINCS+-SHA2-256f  │ │
│  │  (liboqs-python or ECDH/Ed25519 fallback in simulation mode)  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────┐   ┌────────────────────────────────────┐  │
│  │  Quantum Layer        │   │  Symmetric Layer                   │  │
│  │  Qiskit QRNG + BB84   │   │  AES-256-GCM + HKDF-SHA256        │  │
│  └──────────────────────┘   └────────────────────────────────────┘  │
│                                                                     │
│  SQLite / PostgreSQL (SQLAlchemy ORM)                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### Frontend (React/Vite — `frontend/src/`)

| Component | Purpose |
|-----------|---------|
| `AuthContext.tsx` | Global JWT auth state, auto-logout on expiry |
| `api/client.ts` | Typed fetch wrappers for all API calls |
| `pages/Messenger.tsx` | Real-time E2E encrypted chat via WebSockets |
| `pages/ThreatIntelligence.tsx` | Unified hub: AST Analyzer + QASM Sandbox |
| `pages/Benchmark.tsx` | Algorithm timing, attack simulation matrix |
| `pages/CustomAlgorithm.tsx` | BYOA Plugin — load your own cipher for evaluation |
| `pages/QuantumLab.tsx` | BB84 QKD visualizer + custom QASM circuit editor |
| `pages/SecureChat.tsx` | Session-based encrypted chat + Q-Steg integration |
| `pages/Landing.tsx` | Marketing page and algorithm stack overview |
| `pages/Login.tsx` / `Register.tsx` | JWT authentication flow |

### Backend (FastAPI — `backend/`)

| Module | Purpose |
|--------|---------|
| `main.py` | App entrypoint, CORS, SlowAPI rate limiting |
| `database.py` | SQLAlchemy engine (SQLite / Postgres drop-in) |
| `models.py` | ORM: `User`, `Conversation`, `Message` |
| `routes/auth.py` | `/api/auth/register` & `/login` — JWT + KEM keypair generation |
| `routes/messenger.py` | Conversations, Messages, WebSocket endpoint |
| `routes/keys.py` | Session-based key generation (Kyber + McEliece + QRNG + HKDF) |
| `routes/messages.py` | Encrypt / Decrypt / Sign / Verify |
| `routes/benchmark.py` | Algorithm speed benchmarks + attack simulation matrix |
| `routes/analyzer.py` | AST heuristic classical vulnerability scanner |
| `routes/custom.py` | BYOA algorithm evaluation engine |
| `routes/quantum.py` | QRNG, BB84, QASM circuit execution |
| `routes/stego.py` | Q-Steg: QRNG-seeded image steganography |
| `pqc/kyber.py` | CRYSTALS-Kyber1024 (liboqs or ECDH fallback) |
| `pqc/mceliece.py` | Classic McEliece 8192 (liboqs or RSA-OAEP fallback) |
| `pqc/sphincs.py` | SPHINCS+-SHA2-256f signatures (liboqs or Ed25519 fallback) |
| `pqc/fusion.py` | HKDF-SHA256 fusion of three shared secrets → one 256-bit key |
| `quantum/qrng.py` | Hadamard circuits on Qiskit → true quantum random bits |
| `quantum/bb84.py` | BB84 QKD protocol simulation with eavesdrop detection |
| `quantum/qasm.py` | Execute user-submitted OPENQASM 2.0 circuits |
| `crypto/aes.py` | AES-256-GCM authenticated encryption |
| `core/session.py` | In-memory session store (keyed by session_id) |
| `core/audit.py` | Event audit log |
| `core/ws.py` | WebSocket connection manager |
| `core/security.py` | bcrypt password hashing + JWT creation |

---

## 3. Cryptographic Protocol Flow

### Session-Based Chat (SecureChat)

```
Client                          Server
  │                                │
  │── POST /api/keys/generate ─────►│
  │                                │ 1. Generate Kyber1024 keypair
  │                                │ 2. Generate McEliece keypair
  │                                │ 3. Run Qiskit Hadamard QRNG
  │                                │ 4. Kyber.encapsulate() → SS1, CT1
  │                                │ 5. McEliece.encapsulate() → SS2, CT2
  │                                │ 6. HKDF-SHA256(SS1 ‖ SS2 ‖ QRNG) → K_session
  │◄── {session_id, ciphertext} ───│
  │                                │
  │── POST /api/messages/encrypt ──►│
  │   { session_id, plaintext }    │ AES-256-GCM(plaintext, K_session)
  │◄── { ciphertext_b64 } ─────────│
  │                                │
  │── POST /api/messages/sign ─────►│
  │   { session_id, message }      │ SPHINCS+.sign(message_hash, SK_sphincs)
  │◄── { signature_b64 } ──────────│

### Multi-Media E2E Encryption Flow (Audio & Documents)

```
Alice's Browser (Web Crypto API)                                         Server
  │                                                                         │
  │ 1. captureAudio() / selectFile() → ArrayBuffer                          │
  │ 2. crypto.subtle.generateKey(AES-GCM-256) → Payload Key                 │
  │ 3. crypto.getRandomValues(12) → Payload IV                              │
  │ 4. crypto.subtle.encrypt(Payload Key, Payload IV, ArrayBuffer) → CT     │
  │                                                                         │
  │── POST /api/messages/send ─────────────────────────────────────────────►│
  │   { audio/file_data_b64: CT, key, iv }                                  │ Store in DB blindly
  │                                                                         │ WS push to Bob
```

### Messenger Asymmetric E2E Chat (OOB offline nodes)

```
Alice                         Server                         Bob
  │                              │                              │
  │── POST /conversations ───────►│                              │
  │   { recipient_id: Bob }      │ 1. Fresh 32-byte secret S    │
  │                              │ 2. KEM.encap(Alice.pk, S) → ct_A │
  │                              │ 3. KEM.encap(Bob.pk, S) → ct_B   │
  │                              │ 4. Store ct_A (user1), ct_B (user2)   │
  │                              │ 5. Push new_conversation WS event    │
  │◄── { session_key: ct_A } ────│──── WS: { key: ct_B } ──────►│
  │                              │                              │
  │   [Alice decaps ct_A → S]    │               [Bob decaps ct_B → S] │
  │                              │                              │
  │── POST /messenger/send ──────►│                              │
  │   { ciphertext: AES(msg,S) } │── WS: new_message ──────────►│
  │                              │        [Bob decaps S, decrypts msg] │
```

---

## 4. Key Exchange (KEM) Architecture

### `pqc/kyber.py` — CRYSTALS-Kyber1024

```
Mode: "real"        → liboqs oqs.KeyEncapsulation("Kyber1024")
Mode: "simulation"  → ECDH-P256 (clearly labelled, not quantum-safe)

generate_keypair() → (pk: 1568 bytes, sk: 3168 bytes)
encapsulate(pk)    → (ciphertext: 1568 bytes, shared_secret: 32 bytes)
decapsulate(ct,sk) → shared_secret: 32 bytes
encapsulate_with_key(pk, session_key)
  → Wraps a known session_key inside a KEM ciphertext:
     1. KEM.encapsulate(pk) → (ct, ss)
     2. XOR(ss, session_key) → wrapped_key
     3. return (len_ct:2B ‖ ct ‖ wrapped_key)
```

### `pqc/fusion.py` — HKDF Fusion

```
Input:  shared_secret_1 (Kyber)
        shared_secret_2 (McEliece)
        quantum_entropy (QRNG)

Process: HKDF-SHA256(
           IKM = SS1 ‖ SS2 ‖ entropy,
           salt = os.urandom(32),
           info = b"schrodingers-box-v1"
         )

Output: 256-bit session key
```

---

## 5. WebSocket Messenger Architecture

```
Browser                                 FastAPI :8000
   │                                          │
   │── ws://host/api/messenger/ws?token=JWT ──►│
   │                                          │ Verify JWT → user_id
   │                                          │ manager.connect(ws, user_id)
   │◄═══════════════════════════════════════►│ (persistent)
   │                                          │
   │  [Alice sends message via REST]          │
   │── POST /api/messenger/send ─────────────►│
   │   { conv_id, ciphertext_b64 }            │ Persist to DB
   │                                          │ manager.send_personal(Bob_id, payload)
   │                                Bob ◄── WS push ─────────────────│
   │                                          │
```

**Connection Manager** (`core/ws.py`):
```python
Dict[user_id → WebSocket]
send_personal_message(payload, user_id)  # JSON push to single user
```

---

## 6. Algorithm Stack

| Layer | Algorithm | Security Level | Key Size |
|-------|-----------|---------------|---------|
| KEM #1 | CRYSTALS-Kyber1024 | NIST Level 5 | PK: 1568B |
| KEM #2 | Classic McEliece 8192128 | NIST Level 5 | PK: ~1MB |
| Signature | SPHINCS+-SHA2-256f-simple | NIST Level 5 | SIG: 49856B |
| Symmetric | AES-256-GCM | 256-bit | nonce: 12B |
| KDF | HKDF-SHA256 | — | output: 32B |
| Entropy | Qiskit QRNG (Hadamard) | Quantum-random | 32B |
| Auth | JWT (HS256) | — | exp: 8h |
| Passwords | bcrypt | — | cost factor 12 |

---

## 7. Backend Module Tree

```
backend/
├── main.py              # FastAPI app, CORS, SlowAPI rate limiting
├── database.py          # SQLAlchemy engine (SQLite/Postgres)
├── models.py            # ORM: User, Conversation, Message
├── config.py            # ENV vars (USE_LIBOQS, USE_QISKIT, PORT, etc.)
├── seed_db.py           # Seeds Alice, Bob, Charlie test accounts
│
├── pqc/
│   ├── kyber.py         # Kyber1024 KEM (real / ECDH fallback)
│   ├── mceliece.py      # McEliece KEM (real / RSA fallback)
│   ├── sphincs.py       # SPHINCS+ signatures (real / Ed25519 fallback)
│   ├── fusion.py        # HKDF-SHA256 multi-secret derivation
│   └── stego.py         # QRNG-seeded image steganography
│
├── quantum/
│   ├── qrng.py          # Hadamard quantum random number generator
│   ├── bb84.py          # BB84 QKD protocol simulation
│   └── qasm.py          # OPENQASM 2.0 circuit executor
│
├── crypto/
│   ├── aes.py           # AES-256-GCM authenticated encryption
│   └── hkdf_fusion.py   # HKDF key derivation
│
├── core/
│   ├── session.py       # In-memory session store
│   ├── audit.py         # Event audit log
│   ├── ws.py            # WebSocket connection manager
│   ├── security.py      # bcrypt + JWT
│   └── benchmark.py     # Timing + attack simulation
│
└── routes/
    ├── auth.py          # /api/auth/* (register, login) + rate limiting
    ├── messenger.py     # /api/messenger/* + WebSocket
    ├── keys.py          # /api/keys/*
    ├── messages.py      # /api/messages/* (encrypt, decrypt, sign, verify)
    ├── benchmark.py     # /api/benchmark/*
    ├── analyzer.py      # /api/analyzer/* (AST heuristics)
    ├── custom.py        # /api/custom/* (BYOA engine)
    ├── quantum.py       # /api/quantum/* (QRNG, BB84, QASM)
    ├── stego.py         # /api/stego/*
    ├── users.py         # /api/users/*
    └── audit.py         # /api/audit/*
```

---

## 8. Frontend Module Tree

```
frontend/src/
├── main.tsx             # React entrypoint
├── App.tsx              # Router (React Router v6)
├── AuthContext.tsx      # JWT auth state + auto-logout on expiry
├── index.css            # Global dark quantum design system
│
├── api/
│   └── client.ts        # Typed fetch wrappers for all backend APIs
│
└── pages/
    ├── Landing.tsx        # Hero + 6-layer algorithm stack
    ├── Login.tsx          # JWT login form
    ├── Register.tsx       # Account creation
    ├── Messenger.tsx      # E2E encrypted real-time messenger
    ├── SecureChat.tsx     # Session-based chat + Q-Steg
    ├── ThreatIntelligence.tsx # AST Analyzer + QASM Sandbox tab hub
    ├── AlgorithmAnalyzer.tsx  # Classical cipher vulnerability scanner
    ├── QuantumLab.tsx     # BB84 QKD visualizer + QASM editor
    ├── Benchmark.tsx      # Performance benchmarks + attack matrix
    ├── CustomAlgorithm.tsx    # BYOA cipher evaluation engine
    └── Steganography.tsx  # Q-Steg standalone image tool
```

---

## 9. API Surface

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account + generate KEM keypair | None (rate limited: 10/min) |
| POST | `/api/auth/login` | JWT login | None (rate limited: 5/min) |
| GET | `/api/users/` | List all users (for messenger directory) | JWT |
| POST | `/api/keys/generate` | Generate session keys (Kyber + McEliece + QRNG + HKDF) | None |
| POST | `/api/messages/encrypt` | AES-256-GCM encrypt | None |
| POST | `/api/messages/decrypt` | AES-256-GCM decrypt | None |
| POST | `/api/messages/sign` | SPHINCS+ sign | None |
| POST | `/api/messages/verify` | SPHINCS+ verify | None |
| GET | `/api/messenger/conversations` | List my conversations | JWT |
| POST | `/api/messenger/conversations` | Start KEM exchange with peer | JWT |
| GET | `/api/messenger/conversations/{id}/messages` | Message history | JWT |
| POST | `/api/messenger/send` | Send encrypted message | JWT |
| WS | `/api/messenger/ws?token=JWT` | Real-time push notifications | JWT (query param) |
| GET | `/api/benchmark/run` | Run algorithm timing suite | None |
| POST | `/api/analyzer/scan` | AST heuristic scan | None |
| POST | `/api/custom/upload` | Upload BYOA algorithm | None |
| POST | `/api/custom/benchmark` | Benchmark custom algorithm | None |
| GET | `/api/quantum/qrng` | Generate quantum random bytes | None |
| GET | `/api/quantum/bb84` | BB84 QKD simulation | None |
| POST | `/api/quantum/qasm` | Execute OPENQASM 2.0 circuit | None |
| POST | `/api/stego/hide` | Q-Steg: embed message in image | None |
| POST | `/api/stego/reveal` | Q-Steg: extract message from image | None |
| GET | `/api/audit/log` | Read audit log | None |

---

## 10. Security Properties

| Property | Mechanism | Status |
|----------|----------|--------|
| **Harvest-Now-Decrypt-Later resistance** | Kyber1024 + McEliece (NIST PQC standards) | ✅ |
| **Forward Secrecy** | Fresh QRNG entropy in every session key | ✅ |
| **Message Authentication** | AES-256-GCM (authenticated encryption) | ✅ |
| **Message Integrity** | SPHINCS+ signature on each message | ✅ |
| **Identity Authentication** | JWT (HS256, exp enforced client-side) | ✅ |
| **Password Security** | bcrypt (cost factor 12) | ✅ |
| **Brute-Force Protection** | SlowAPI rate limiting (5 logins/min/IP) | ✅ |
| **Asymmetric KEM** | Per-user encapsulated keys (ct_A ≠ ct_B) | ✅ |
| **Quantum Entropy** | Qiskit Hadamard QRNG (or os.urandom fallback) | ✅ |

---

## 11. Threat Model

### Addressed
- **Nation-state CRQC (Cryptographically Relevant Quantum Computer)** — Kyber1024 + McEliece are lattice and code-based; immune to Shor's algorithm
- **Server compromise** — Encapsulated keys stored; raw session key never persisted
- **Eavesdropping** — AES-256-GCM with authenticated encryption; SPHINCS+ digital signature
- **Brute-force login** — SlowAPI 5 req/min on `/api/auth/login`
- **Stale session tokens** — JWT expiry enforced on client with auto-logout timer

### Out of Scope (Hackathon)
- **Client-side WASM KEM** — Browser has no native Kyber WASM bindings; server acts as KEM oracle (trusted server assumption)
- **Key revocation** — No PKI infrastructure; static keys per account
- **Private key storage** — Server holds KEM secret keys (production: HSM or client-side WASM)
- **Perfect Forward Secrecy per message** — Session key is reused for conversation lifetime

---

## 12. Data Flow Diagram

```
[User Alice]
     │ Register
     ▼
[POST /api/auth/register]
     │ bcrypt(password) → password_hash
     │ Kyber.keygen() → (pk_A, sk_A)
     │ McEliece.keygen() → (pk_A2, sk_A2)
     │ Store: users(alice, pk_A, pk_A2)
     │ Return: JWT(alice_id, exp=8h)
     ▼
[Alice opens Messenger → selects Bob]
     │
[POST /api/messenger/conversations { recipient: bob_id }]
     │ os.urandom(32) → S
     │ HKDF(S, S, S) → session_key K
     │ KEM.encap_with_key(pk_A, K) → ct_A  ← Alice's blob
     │ KEM.encap_with_key(pk_B, K) → ct_B  ← Bob's blob
     │ DB: conversations(ct_A, ct_B)
     │ WS push to Bob: { key: ct_B }
     │ Return to Alice: { key: ct_A }
     ▼
[Alice types message]
     │ POST /api/messages/encrypt { session_key: ct_A, plaintext }
     │ Server: AES-256-GCM(plaintext, ct_A) → ciphertext
     │ POST /api/messenger/send { conv_id, ciphertext }
     │ DB: messages(ciphertext)
     │ WS push to Bob: { ciphertext }
     ▼
[Bob receives WS push]
     │ POST /api/messages/decrypt { session_key: ct_B, ciphertext }
     │ Server: AES-256-GCM.decrypt(ciphertext, ct_B) → plaintext
     │ Render plaintext in UI
```

---

## 13. Deployment Architecture

### Local Development
```
npm run dev          → Frontend :5173  (Vite HMR)
python main.py       → Backend  :8000  (Uvicorn reload)
```

### Production (Suggested)
```
                    ┌──────────────────────┐
                    │    Reverse Proxy      │
                    │    (nginx / Caddy)    │
                    │    TLS termination    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐  ┌─────▼──────┐  ┌─────▼──────┐
     │ Static Frontend │  │  FastAPI   │  │ PostgreSQL  │
     │ (CDN / Netlify) │  │ (Render /  │  │ (Neon /    │
     │                 │  │  Railway)  │  │  Supabase)  │
     └─────────────────┘  └────────────┘  └─────────────┘
```

### Environment Variables
```bash
USE_LIBOQS=true          # Enable real PQC (requires liboqs-python installed)
USE_QISKIT=true          # Enable Qiskit QRNG (requires qiskit-aer)
DATABASE_URL=sqlite:///./schrodingers_box.db  # or postgres://...
CORS_ORIGINS=http://localhost:5173
PORT=8000
SECRET_KEY=<random-256-bit-hex>   # JWT signing key
```
