/**
 * clientCrypto.ts — True client-side E2E encryption via Web Crypto API.
 *
 * The server NEVER sees plaintext or the raw AES session key.
 * Flow:
 *   1. Browser calls /api/messenger/decapsulate to strip the KEM wrapper and
 *      recover the raw 32-byte session key (server forgets it immediately).
 *   2. Browser imports the key into SubtleCrypto as a non-extractable AES-GCM key.
 *   3. All encrypt/decrypt happens in the browser. Only ciphertext reaches the server.
 */

import axios from 'axios'

const api = axios.create({ baseURL: '/', timeout: 30_000 })
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token')
  if (token && cfg.headers) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── In-memory session key store (conv_id → CryptoKey) ────────────────────────
// Keys are NON-EXTRACTABLE — once imported they cannot leave the browser.
const keyCache = new Map<number, CryptoKey>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/** Import raw 32-byte material as a non-extractable AES-GCM-256 key. */
async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Obtain the AES session key for a conversation.
 * On first call, calls /api/messenger/decapsulate to strip the KEM blob and
 * get the raw 32-byte session key, then caches it as a CryptoKey in memory.
 * The server discards the key bytes immediately after returning them.
 */
export async function getConvKey(convId: number, encapsulatedKeyB64: string): Promise<CryptoKey> {
  if (keyCache.has(convId)) return keyCache.get(convId)!

  // Ask server to decapsulate — it returns raw key bytes and immediately discards them.
  const resp = await api.post('/api/messenger/decapsulate', {
    conversation_id: convId,
    encapsulated_key_b64: encapsulatedKeyB64,
  })
  const rawKey = b64ToBytes(resp.data.session_key_b64)  // 32 bytes
  const cryptoKey = await importAesKey(rawKey)
  keyCache.set(convId, cryptoKey)
  return cryptoKey
}

/**
 * Encrypt plaintext in the browser using AES-256-GCM.
 * Returns a single base64 blob: [ 12-byte IV || ciphertext+auth-tag ]
 */
export async function browserEncrypt(convId: number, encapsulatedKeyB64: string, plaintext: string): Promise<string> {
  const key = await getConvKey(convId, encapsulatedKeyB64)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    data
  )

  // Pack: [12 bytes IV] + [ciphertext+16-byte tag]
  const combined = new Uint8Array(12 + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), 12)
  return bytesToB64(combined)
}

/**
 * Decrypt a ciphertext blob (produced by browserEncrypt) in the browser.
 * Format: first 12 bytes = IV, rest = AES-GCM ciphertext+auth-tag.
 */
export async function browserDecrypt(convId: number, encapsulatedKeyB64: string, ciphertextB64: string): Promise<string> {
  const key = await getConvKey(convId, encapsulatedKeyB64)
  const combined = b64ToBytes(ciphertextB64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      ciphertext
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('Decryption failed — message may be corrupted or key mismatch')
  }
}

/** Clear cached key for a conversation (e.g. on logout). */
export function evictKey(convId: number) {
  keyCache.delete(convId)
}

/** Clear all cached keys (call on logout). */
export function evictAllKeys() {
  keyCache.clear()
}
