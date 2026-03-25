/**
 * client.ts — Typed Axios API client for the Schrödinger's Box backend.
 * All backend calls go through these functions.
 */

import axios from 'axios'

// The Vite proxy in vite.config.ts routes /api → http://localhost:8000
const api = axios.create({ baseURL: '/', timeout: 60_000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ──────────────────────────────────────────────────────────────────

export interface KeyGenResponse {
  session_id: string
  mode: 'real' | 'simulation'
  security_score: number
  kyber: { public_key_b64: string; ciphertext_b64: string; public_key_bytes: number; ciphertext_bytes: number; algorithm: string }
  mceliece: { public_key_b64: string; ciphertext_b64: string; public_key_bytes: number; ciphertext_bytes: number; algorithm: string }
  sphincs: { public_key_b64: string; public_key_bytes: number; algorithm: string }
  quantum_entropy: { entropy_b64: string; bits_generated: number; mode: string; circuit_description: string }
  session_key_b64: string
  algorithms_used: string[]
}

export interface EncryptResponse {
  session_id: string
  ciphertext_b64: string
  ciphertext_bytes: number
  algorithm: string
  authenticated: boolean
}

export interface DecryptResponse {
  session_id: string
  plaintext: string
  verified: boolean
}

export interface SignResponse {
  session_id: string
  message_b64: string
  signature_b64: string
  signature_bytes: number
  algorithm: string
}

export interface VerifyResponse {
  session_id: string
  valid: boolean
  algorithm: string
}

export interface BenchmarkAlgo {
  algorithm: string
  family: string
  type: string
  keygen_ms: number
  encap_ms?: number
  decap_ms?: number
  sign_ms?: number
  verify_ms?: number
  public_key_bytes: number
  private_key_bytes: number
  ciphertext_bytes?: number
  signature_bytes?: number
  memory_delta_kb: number
  shared_secret_match?: boolean
  signature_valid?: boolean
}

export interface BenchmarkResponse {
  algorithms: BenchmarkAlgo[]
  summary: { total_keygen_ms: number; total_public_key_bytes: number; mode: string }
  attack_simulation: any[]
}

export interface QRNGResponse {
  entropy_hex: string
  entropy_b64: string
  bits_generated: number
  bytes_generated: number
  mode: 'quantum' | 'classical'
  circuit_description: string
}

export interface BB84Response {
  n_bits_transmitted: number
  sifted_key_length: number
  final_key_length_bits: number
  qber: number
  eve_detected: boolean
  eve_present: boolean
  shared_key_b64: string
  shared_key_bytes: number
  mode: string
  protocol: string
  alice_bits_preview: number[]
  alice_bases_preview: string[]
  bob_bases_preview: string[]
  bob_results_preview: number[]
  basis_match_preview: boolean[]
}

export interface AuditEvent {
  timestamp: string
  event_type: string
  session_id: string | null
  algorithm: string | null
  detail: string
  success: boolean
}

// ── API Functions ──────────────────────────────────────────────────────────

export const generateKeys = (): Promise<KeyGenResponse> =>
  api.post('/api/keys/generate').then(r => r.data)

export const getSession = (session_id: string): Promise<KeyGenResponse> =>
  api.get(`/api/keys/${session_id}`).then(r => r.data)

export const sendRawMessage = (
  session_id: string, role: string, ciphertext_b64: string, signature_b64: string, message_b64: string,
  stego_image_b64?: string, stego_seed?: string,
  audio_data_b64?: string, audio_iv_b64?: string, audio_key_b64?: string,
  file_data_b64?: string, file_name?: string, file_type?: string, file_iv_b64?: string, file_key_b64?: string
): Promise<any> =>
  api.post('/api/messages/send', { 
    session_id, role, ciphertext_b64, signature_b64, message_b64, 
    stego_image_b64, stego_seed, 
    audio_data_b64, audio_iv_b64, audio_key_b64,
    file_data_b64, file_name, file_type, file_iv_b64, file_key_b64 
  }).then(r => r.data)

export const syncMessages = (session_id: string): Promise<{messages: any[]}> =>
  api.get(`/api/messages/sync/${session_id}`).then(r => r.data)

export const encryptMessage = (sessionId: string | null, plaintext: string, useCustom: boolean = false, sessionKeyB64?: string): Promise<EncryptResponse> =>
  api.post('/api/messages/encrypt', { session_id: sessionId, plaintext, use_custom_algo: useCustom, session_key_b64: sessionKeyB64 }).then(r => r.data)

export const decryptMessage = (sessionId: string | null, ciphertextB64: string, useCustom: boolean = false, sessionKeyB64?: string): Promise<DecryptResponse> =>
  api.post('/api/messages/decrypt', { session_id: sessionId, ciphertext_b64: ciphertextB64, use_custom_algo: useCustom, session_key_b64: sessionKeyB64 }).then(r => r.data)

export const signMessage = (session_id: string, message: string): Promise<SignResponse> =>
  api.post('/api/messages/sign', { session_id, message }).then(r => r.data)

export const verifyMessage = (session_id: string, message_b64: string, signature_b64: string): Promise<VerifyResponse> =>
  api.post('/api/messages/verify', { session_id, message_b64, signature_b64 }).then(r => r.data)

export const runBenchmark = (): Promise<BenchmarkResponse> =>
  api.get('/api/benchmark/run').then(r => r.data)

export const fetchQRNG = (bits = 256): Promise<QRNGResponse> =>
  api.get(`/api/quantum/qrng?bits=${bits}`).then(r => r.data)

export const fetchBB84 = (bits = 100, eve = false): Promise<BB84Response> =>
  api.get(`/api/quantum/bb84?bits=${bits}&eve=${eve}`).then(r => r.data)

export const fetchAuditLog = (session_id?: string): Promise<{ events: AuditEvent[]; count: number }> =>
  api.get(`/api/audit/log${session_id ? `?session_id=${session_id}` : ''}`).then(r => r.data)

export const getHealth = () => api.get('/health').then(r => r.data)

export const simulateQasm = (qasm: string, shots: number): Promise<any> =>
  api.post('/api/quantum/simulate_qasm', { qasm, shots }).then(r => r.data)

export const hideStegoMessage = (formData: FormData): Promise<Blob> =>
  api.post('/api/stego/hide', formData, { responseType: 'blob' }).then(r => {
    // The seed is returned in the X-Quantum-Seed header
    const seed = r.headers['x-quantum-seed'];
    // We attach it to the blob as custom property so UI can read it
    const blob: any = r.data;
    blob.quantumSeed = seed;
    return blob;
  })

export const extractStegoMessage = (formData: FormData): Promise<any> =>
  api.post('/api/stego/extract', formData).then(r => r.data)

export interface CustomBenchmarkEvaluation {
  shor: string;
  grover: string;
  classical_strength: string;
  bruteforce: {
    classical: string;
    quantum: string;
  };
  harvest_attack: string;
  avalanche_score: string;
  entropy: string;
  final_score: string;
}

export interface CustomBenchmarkResponse {
  success: boolean;
  results: any[];
  overall_correct: boolean;
  summary: any;
  evaluation: CustomBenchmarkEvaluation;
}

export const analyzeAlgorithm = (formData: FormData): Promise<any> =>
  api.post('/api/analyze/upload', formData).then(r => r.data)

export const registerCustomAlgo = (code: string): Promise<any> =>
  api.post('/api/custom/register', { code }).then(r => r.data)

export const benchmarkCustomAlgo = (): Promise<CustomBenchmarkResponse> =>
  api.post('/api/custom/benchmark').then(r => r.data)

// ── Role-Based Auth & Real-Time E2E Messenger ────────────────────────────────

export interface DbUser {
  id: number;
  username: string;
  kyber_pk: string;
  mceliece_pk: string;
  role: string;
}

export interface Conversation {
  id: number;
  other_user: { id: number; username: string };
  my_encapsulated_key: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  ciphertext_b64: string;
  signature_b64: string | null;
  timestamp: string;
}

export const registerUser = (data: any): Promise<any> =>
  api.post('/api/auth/register', data).then(r => r.data)

export const loginUser = (data: any): Promise<any> =>
  api.post('/api/auth/login', data).then(r => r.data)

export const getUsers = (): Promise<DbUser[]> =>
  api.get('/api/users/').then(r => r.data)

export const getConversations = (): Promise<Conversation[]> =>
  api.get('/api/messenger/conversations').then(r => r.data)

export const createConversation = (data: any): Promise<{id: number, session_key_b64?: string, message?: string}> =>
  api.post('/api/messenger/conversations', data).then(r => r.data)

export const getMessages = (conversationId: number): Promise<DirectMessage[]> =>
  api.get(`/api/messenger/conversations/${conversationId}/messages`).then(r => r.data)

export const sendDirectMessage = (data: any): Promise<any> =>
  api.post('/api/messenger/send', data).then(r => r.data)

export const visualizeLayers = (session_id: string, plaintext: string): Promise<any> =>
  api.post('/api/visualizer/layers', { session_id, plaintext }).then(r => r.data)

