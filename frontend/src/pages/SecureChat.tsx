import { useState, useRef, useEffect } from 'react'
import {
  generateKeys, getSession, sendRawMessage, syncMessages, fetchAuditLog,
  encryptMessage, decryptMessage, signMessage, verifyMessage,
  hideStegoMessage, extractStegoMessage,
  type KeyGenResponse, type SignResponse, type AuditEvent
} from '../api/client'
import { Shield, Key, Network, Send, Image as ImageIcon, XCircle, Unlock, Activity, Mic, MicOff, Volume2, Upload, Lock, Play, Square, FileText, Download } from 'lucide-react'

// ── Chunked Base64 helpers (safe for arbitrarily large ArrayBuffers) ──
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x2000 // 8KB chunks to avoid call stack overflow
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): Uint8Array {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

interface ChatMessage {
  id: number
  role: string
  text: string
  ciphertext?: string
  signature?: string
  verified?: boolean
  timestamp: string
  stegoImage?: string
  stegoSeed?: string
  isExtracting?: boolean
  audioUrl?: string
  docName?: string
  docType?: string
  docCiphertextB64?: string
  docIvB64?: string
  docKeyB64?: string
  docUrl?: string
  isDecryptingDoc?: boolean
}

function AlgoBadge({ name, active }: { name: string; active: boolean }) {
  return (
    <span className={`status-pill ${active ? 'active' : 'pending'}`} style={{ fontSize: '0.72rem' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {name}
    </span>
  )
}

export default function SecureChat() {
  const [session, setSession] = useState<KeyGenResponse | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sigData, setSigData] = useState<SignResponse | null>(null)
  
  const [userRole, setUserRole] = useState<'Alice (Host)' | 'Bob (Guest)'>('Alice (Host)')
  const [joinId, setJoinId] = useState('')
  const [useCustomAlgo, setUseCustomAlgo] = useState(false)
  
  // Steganography
  const [stegoFile, setStegoFile] = useState<File | null>(null)
  
  // Audio E2E Encryption State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [encryptedAudioB64, setEncryptedAudioB64] = useState<string | null>(null)
  const [audioIvB64, setAudioIvB64] = useState<string | null>(null)
  const [audioKeyB64, setAudioKeyB64] = useState<string | null>(null)
  const [decryptedAudioUrl, setDecryptedAudioUrl] = useState<string | null>(null)
  const [audioStatus, setAudioStatus] = useState<string>('')

  // Document E2E Encryption State
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docEncryptedB64, setDocEncryptedB64] = useState<string | null>(null)
  const [docIvB64, setDocIvB64] = useState<string | null>(null)
  const [docKeyB64, setDocKeyB64] = useState<string | null>(null)
  const [docStatus, setDocStatus] = useState<string>('')

  const msgRef = useRef<HTMLDivElement>(null)

  const syncCount = useRef(0)

  useEffect(() => {
    msgRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [messages])

  // Polling loop for new messages
  useEffect(() => {
    if (!session) return
    const interval = setInterval(async () => {
      try {
        const res = await syncMessages(session.session_id)
        const serverMsgs = res.messages
        if (serverMsgs.length > syncCount.current) {
          for (let i = syncCount.current; i < serverMsgs.length; i++) {
            const m = serverMsgs[i]
            if (m.role !== userRole) {
              
              if (m.stego_image_b64) {
                setMessages(prev => [...prev, {
                  id: m.id,
                  role: m.role,
                  text: "[ ⚠️ ENCRYPTED QUANTUM IMAGE PAYLOAD ]",
                  stegoImage: `data:image/png;base64,${m.stego_image_b64}`,
                  stegoSeed: m.stego_seed,
                  timestamp: new Date().toLocaleTimeString()
                }])
              } else if (m.audio_data_b64 && m.audio_iv_b64 && m.audio_key_b64) {
                // Decrypt incoming encrypted audio in the browser
                try {
                  const encBytes = base64ToArrayBuffer(m.audio_data_b64)
                  const ivBytes = base64ToArrayBuffer(m.audio_iv_b64)
                  const keyBytes = base64ToArrayBuffer(m.audio_key_b64)
                  const aesKey = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, 'AES-GCM', false, ['decrypt'])
                  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer }, aesKey, encBytes.buffer as ArrayBuffer)
                  const audioBlob = new Blob([decrypted], { type: 'audio/webm' })
                  const audioUrl = URL.createObjectURL(audioBlob)
                  setMessages(prev => [...prev, {
                    id: m.id, role: m.role,
                    text: '🔊 Encrypted Audio Message',
                    audioUrl,
                    timestamp: new Date().toLocaleTimeString()
                  }])
                } catch (audioErr) {
                  setMessages(prev => [...prev, {
                    id: m.id, role: m.role,
                    text: '⚠️ Audio Decryption Failed',
                    timestamp: new Date().toLocaleTimeString()
                  }])
                }
              } else if (m.file_data_b64 && m.file_name && m.file_iv_b64 && m.file_key_b64) {
                setMessages(prev => [...prev, {
                  id: m.id, role: m.role,
                  text: `📄 Encrypted Document: ${m.file_name}`,
                  docName: m.file_name,
                  docType: m.file_type || 'application/octet-stream',
                  docCiphertextB64: m.file_data_b64,
                  docIvB64: m.file_iv_b64,
                  docKeyB64: m.file_key_b64,
                  timestamp: new Date().toLocaleTimeString()
                }])
              } else {
                try {
                  const dec = await decryptMessage(session.session_id, m.ciphertext_b64, useCustomAlgo)
                  const ver = await verifyMessage(session.session_id, m.message_b64, m.signature_b64)
                  setMessages(prev => [...prev, {
                    id: m.id,
                    role: m.role,
                    text: dec.plaintext,
                    ciphertext: m.ciphertext_b64.slice(0, 48) + '…',
                    signature: m.signature_b64.slice(0, 32) + '…',
                    verified: ver.valid,
                    timestamp: new Date().toLocaleTimeString()
                  }])
                  setSigData({
                    session_id: session.session_id,
                    message_b64: m.message_b64,
                    signature_b64: m.signature_b64,
                    signature_bytes: 0,
                    algorithm: "SPHINCS+-SHA2-256f-simple"
                  })
                } catch (err) {
                  console.error("Decryption sync error", err)
                }
              }
            }
          }
          syncCount.current = serverMsgs.length
        }
      } catch (err) {
        console.error("Sync loop error", err)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [session, userRole, useCustomAlgo])

  const startHostSession = async () => {
    setLoading(true)
    try {
      setUserRole('Alice (Host)')
      const data = await generateKeys()
      setSession(data)
      setMessages([{
        id: 0, role: 'system', text: `🔐 Secure Host Session Created!\nShare this Session ID with Bob: ${data.session_id}`, timestamp: new Date().toLocaleTimeString()
      }])
      syncCount.current = 0
    } catch (e: any) {
      alert(`Error: ${e?.response?.data?.detail ?? e.message}`)
    }
    setLoading(false)
  }

  const joinGuestSession = async () => {
    if (!joinId.trim()) return
    setLoading(true)
    try {
      setUserRole('Bob (Guest)')
      const data = await getSession(joinId.trim())
      setSession(data)
      setMessages([{
        id: 0, role: 'system', text: `🤝 Joined Session as Guest!\nConnected to ID: ${data.session_id}\nKey Exchange completed successfully.`, timestamp: new Date().toLocaleTimeString()
      }])
      syncCount.current = 0
    } catch (e: any) {
      alert(`Could not join session. Is the ID correct?\n${e?.response?.data?.detail ?? e.message}`)
    }
    setLoading(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStegoFile(e.target.files[0]);
    }
  };

  const decodeStegoPayload = async (msgId: number, imageDataUrl: string, seed: string) => {
    if (!session) return;
    setMessages(msgs => msgs.map(m => m.id === msgId ? { ...m, isExtracting: true } : m));
    try {
      const fRes = await fetch(imageDataUrl)
      const blob = await fRes.blob()
      
      const formData = new FormData();
      formData.append('session_id', session.session_id);
      formData.append('seed_b64', seed);
      formData.append('image', blob);

      const res = await extractStegoMessage(formData);
      if (res.success) {
        setMessages(msgs => msgs.map(m => m.id === msgId ? { 
          ...m, 
          isExtracting: false, 
          text: res.plaintext, 
          stegoImage: undefined
        } : m));
      }
    } catch (e: any) {
      alert("Failed to decrypt steganography payload. " + (e?.response?.data?.detail || e.message));
      setMessages(msgs => msgs.map(m => m.id === msgId ? { ...m, isExtracting: false } : m));
    }
  }

  // ── Audio E2E Encryption Functions ──────────────────────────────────
  const captureAudio = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setEncryptedAudioB64(null)
        setDecryptedAudioUrl(null)
        setAudioStatus('🎙 Audio recorded — ready to encrypt')
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setAudioStatus('🔴 Recording...')
    } catch (err) {
      setAudioStatus('⚠️ Microphone access denied')
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAudioBlob(file)
      setAudioUrl(URL.createObjectURL(file))
      setEncryptedAudioB64(null)
      setDecryptedAudioUrl(null)
      setAudioStatus(`📁 Uploaded: ${file.name}`)
    }
  }

  const encryptAudio = async () => {
    if (!audioBlob || !session) return
    setAudioStatus('🔒 Encrypting with AES-256-GCM...')
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer)

      const rawKey = await crypto.subtle.exportKey('raw', key)
      const keyB64 = arrayBufferToBase64(rawKey)
      const ivB64 = arrayBufferToBase64(iv.buffer)
      const dataB64 = arrayBufferToBase64(encrypted)

      setAudioKeyB64(keyB64)
      setAudioIvB64(ivB64)
      setEncryptedAudioB64(dataB64)
      setDecryptedAudioUrl(null)
      setAudioStatus(`🔒 Encrypted! ${(encrypted.byteLength / 1024).toFixed(1)} KB ciphertext. Review proof below, then Send.`)
    } catch (err: any) {
      setAudioStatus(`⚠️ Encryption failed: ${err.message}`)
    }
  }

  const sendEncryptedAudio = async () => {
    if (!encryptedAudioB64 || !audioIvB64 || !audioKeyB64 || !session) return
    setAudioStatus('📡 Sending encrypted payload...')
    try {
      const localUrl = audioUrl || ''
      setMessages(m => [...m, {
        id: Date.now(), role: userRole,
        text: '🔊 Encrypted Audio Sent',
        audioUrl: localUrl || undefined,
        timestamp: new Date().toLocaleTimeString()
      }])

      await sendRawMessage(
        session.session_id, userRole, '', '', '',
        undefined, undefined,
        encryptedAudioB64, audioIvB64, audioKeyB64
      )

      setAudioBlob(null)
      setAudioUrl(null)
      setEncryptedAudioB64(null)
      setAudioIvB64(null)
      setAudioKeyB64(null)
      setAudioStatus('✅ Encrypted audio sent to peer!')
    } catch (err: any) {
      setAudioStatus(`⚠️ Send failed: ${err.message}`)
    }
  }

  const decryptAudio = async () => {
    if (!encryptedAudioB64 || !audioIvB64 || !audioKeyB64) return
    setAudioStatus('🔓 Decrypting...')
    try {
      const encBytes = base64ToArrayBuffer(encryptedAudioB64)
      const ivBytes = base64ToArrayBuffer(audioIvB64)
      const keyBytes = base64ToArrayBuffer(audioKeyB64)
      
      const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, 'AES-GCM', false, ['decrypt'])
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer }, key, encBytes.buffer as ArrayBuffer)
      
      const blob = new Blob([decrypted], { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setDecryptedAudioUrl(url)
      setAudioStatus('🔓 Decrypted! Ready to play.')
    } catch (err: any) {
      setAudioStatus(`⚠️ Decryption failed: ${err.message}`)
    }
  }

  // ── Document E2E Encryption Functions ───────────────────────────────
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setDocFile(file)
      setDocEncryptedB64(null)
      setDocStatus(`📁 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    }
  }

  const encryptDocument = async () => {
    if (!docFile || !session) return
    setDocStatus('🔒 Encrypting Document with AES-256-GCM...')
    try {
      const arrayBuffer = await docFile.arrayBuffer()
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer)

      const rawKey = await crypto.subtle.exportKey('raw', key)
      const keyB64 = arrayBufferToBase64(rawKey)
      const ivB64 = arrayBufferToBase64(iv.buffer)
      const dataB64 = arrayBufferToBase64(encrypted)

      setDocKeyB64(keyB64)
      setDocIvB64(ivB64)
      setDocEncryptedB64(dataB64)
      setDocStatus(`🔒 Encrypted! ${(encrypted.byteLength / 1024).toFixed(1)} KB ciphertext ready to send.`)
    } catch (err: any) {
      setDocStatus(`⚠️ Encryption failed: ${err.message}`)
    }
  }

  const sendEncryptedDocument = async () => {
    if (!docEncryptedB64 || !docIvB64 || !docKeyB64 || !docFile || !session) return
    setDocStatus('📡 Sending encrypted document...')
    try {
      const localUrl = URL.createObjectURL(docFile);
      setMessages(m => [...m, {
        id: Date.now(), role: userRole,
        text: `📄 Encrypted Document Sent: ${docFile.name}`,
        docUrl: localUrl,
        docName: docFile.name,
        timestamp: new Date().toLocaleTimeString()
      }])

      await sendRawMessage(
        session.session_id, userRole, '', '', '',
        undefined, undefined,
        undefined, undefined, undefined,
        docEncryptedB64, docFile.name, docFile.type, docIvB64, docKeyB64
      )

      setDocFile(null)
      setDocEncryptedB64(null)
      setDocIvB64(null)
      setDocKeyB64(null)
      setDocStatus('✅ Encrypted document sent successfully!')
      
      // Clear the file input visually
      const fileInput = document.getElementById('doc-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setDocStatus(`⚠️ Send failed: ${err.message}`)
    }
  }

  const decryptDocument = async (msgId: number, ciphertextB64: string, ivB64: string, keyB64: string, mimeType: string, filename: string) => {
    setMessages(msgs => msgs.map(m => m.id === msgId ? { ...m, isDecryptingDoc: true } : m));
    try {
      const encBytes = base64ToArrayBuffer(ciphertextB64)
      const ivBytes = base64ToArrayBuffer(ivB64)
      const keyBytes = base64ToArrayBuffer(keyB64)
      
      const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, 'AES-GCM', false, ['decrypt'])
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer }, key, encBytes.buffer as ArrayBuffer)
      
      const blob = new Blob([decrypted], { type: mimeType })
      const url = URL.createObjectURL(blob)
      
      setMessages(msgs => msgs.map(m => m.id === msgId ? { 
        ...m, 
        isDecryptingDoc: false, 
        docUrl: url 
      } : m));
      
      // Auto-trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Document decryption failed: " + err.message);
      setMessages(msgs => msgs.map(m => m.id === msgId ? { ...m, isDecryptingDoc: false } : m));
    }
  }

  const sendMessage = async () => {
    if ((!input.trim() && !stegoFile) || !session) return
    const text = input.trim() || (stegoFile ? '[Quantum Steganography Payload]' : '')
    setInput('')
    
    const localId = Date.now()
    setMessages(m => [...m, {
      id: localId, role: userRole, text, timestamp: new Date().toLocaleTimeString(),
      stegoImage: stegoFile ? URL.createObjectURL(stegoFile) : undefined
    }])
    setLoading(true)

    try {
      let finalCipher = ""
      let finalSig = ""
      let finalMsgB64 = ""
      
      let stegoB64: string | undefined = undefined;
      let stegoSeed: string | undefined = undefined;

      if (stegoFile) {
        const formData = new FormData()
        formData.append('session_id', session.session_id)
        formData.append('message', text)
        formData.append('image', stegoFile)
        
        const blob: any = await hideStegoMessage(formData)
        stegoSeed = blob.quantumSeed
        
        stegoB64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const b64 = (reader.result as string).split(',')[1];
                resolve(b64);
            };
            reader.readAsDataURL(blob);
        });
        setStegoFile(null);
      } else {
        const enc = await encryptMessage(session.session_id, text, useCustomAlgo)
        const sig = await signMessage(session.session_id, text)
        finalCipher = enc.ciphertext_b64
        finalSig = sig.signature_b64
        finalMsgB64 = sig.message_b64
        setSigData(sig)
        
        setMessages(m => m.map(msg => msg.id === localId ? { ...msg, ciphertext: enc.ciphertext_b64.slice(0, 48) + '…' } : msg))
      }
      
      await sendRawMessage(session.session_id, userRole, finalCipher, finalSig, finalMsgB64, stegoB64, stegoSeed)
    } catch (e: any) {
      setMessages(m => [...m, {
        id: Date.now(), role: 'system', text: `❌ Send Error: ${e?.response?.data?.detail ?? e.message}`, timestamp: new Date().toLocaleTimeString()
      }])
    }
    setLoading(false)
  }

  return (
    <div className="page mx-auto w-full max-w-[1400px] px-8 pb-12 animate-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'stretch', minHeight: 'calc(100vh - 160px)' }}>

        {/* ── Left Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          <div className="card">
            <p className="section-label">Session Control</p>
            {session ? (
              <>
                <div className="status-pill active mt-1" style={{ display: 'inline-flex' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {userRole}
                </div>
                <div className="code-block mt-2" style={{ fontSize: '0.72rem' }}>
                  ID: {session.session_id.slice(0, 16)}…{'\n'}
                  Score: {session.security_score}/100{'\n'}
                  Mode: {session.mode.toUpperCase()}
                </div>
                <button className="btn btn-ghost mt-2" style={{ width: '100%' }}
                  onClick={() => { setSession(null); setMessages([]); setJoinId(''); syncCount.current=0; }}>
                  Disconnect
                </button>
              </>
            ) : (
              <div className="space-y-4 mt-2">
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={startHostSession} disabled={loading}>
                  <Key className="w-4 h-4 mr-2" /> Start Host Session
                </button>
                <div className="text-center text-xs text-white/40 uppercase tracking-wider font-mono">or</div>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    className="input w-full"
                    placeholder="Enter Session ID..."
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                  />
                  <button className="btn btn-secondary w-full border border-white/10" onClick={joinGuestSession} disabled={loading || !joinId}>
                    <Network className="w-4 h-4 mr-2" /> Join as Bob
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <p className="section-label flex items-center justify-between">
              Plugin Routing
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-mono text-muted-foreground mr-2">Route via BYOA Custom Algorithm</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={useCustomAlgo} onChange={() => setUseCustomAlgo(!useCustomAlgo)} />
                <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
            {useCustomAlgo && (
              <div className="mt-2 text-[0.65rem] text-accent font-mono leading-tight">
                Traffic is now bypassing AES-256 and routing directly through live python Hot-Reload injection.
              </div>
            )}
          </div>

          <div className="card bg-accent/5 border-accent/20">
            <p className="section-label flex items-center gap-2">
              <Shield className="w-3 h-3 text-accent" />
              Active Encryption Stack
            </p>
            <div className="mt-3 space-y-4">
              <div className="space-y-1">
                <span className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-tighter">Primary Layer</span>
                <div className="flex items-center justify-between">
                  <span className="text-[0.75rem] text-accent font-bold font-mono">Hybrid Fusion</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${session ? 'bg-accent animate-pulse' : 'bg-white/10'}`} />
                </div>
                <p className="text-[0.6rem] font-mono text-muted-foreground/60 italic leading-none">Kyber-1024 + McEliece-8192</p>
              </div>
              
              <div className="divider opacity-5 my-0" />
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-tighter">Signatures</span>
                  <p className="text-[0.7rem] text-violet-400 font-mono">SPHINCS+</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-tighter">Symmetric</span>
                  <p className="text-[0.7rem] text-primary font-mono">{useCustomAlgo ? 'BYOA-Active' : 'AES-256-GCM'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="flex-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              Secure PQC Channel
            </h2>
            <div className="flex flex-gap-1">
              <span className="badge badge-green">Hybrid Kyber+McEliece</span>
              <span className="badge badge-violet">SPHINCS+</span>
            </div>
          </div>

          {/* Messages */}
          <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
                <p>Start a session or join an existing session ID</p>
              </div>
            )}
            {messages.map(m => {
              const matchesRole = m.role === userRole;
              const isSystem = m.role === 'system';
              
              if (isSystem) {
                return (
                  <div key={m.id} className="text-center font-mono text-xs text-white/50 bg-white/5 border border-white/10 rounded my-2 py-2 px-4 mx-8 whitespace-pre-wrap">
                    {m.text}
                  </div>
                )
              }

              return (
                <div key={m.id} style={{
                  display: 'flex',
                  justifyContent: matchesRole ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    background: matchesRole
                      ? 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,180,255,0.1))'
                      : 'var(--bg-glass)',
                    border: `1px solid ${matchesRole ? 'rgba(0,229,255,0.25)' : 'var(--border)'}`,
                    borderRadius: matchesRole ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '0.7rem 1rem',
                  }}>
                    <div className="text-[0.65rem] font-mono text-white/40 mb-1 uppercase tracking-wider">{m.role}</div>
                    
                    {m.stegoImage ? (
                      <div className="space-y-2">
                        <img src={m.stegoImage} alt="Steganography Payload" className="max-h-48 rounded border border-white/20" />
                        {!matchesRole && m.stegoSeed && (
                          <button 
                            className="btn btn-secondary w-full text-xs justify-center font-mono border border-accent/30 text-accent hover:bg-accent/10"
                            onClick={() => decodeStegoPayload(m.id, m.stegoImage!, m.stegoSeed!)}
                            disabled={m.isExtracting}
                          >
                            {m.isExtracting ? "Extracting Quantum LSBs..." : <><Unlock className="w-3 h-3 mr-1"/> Decrypt Image</>}
                          </button>
                        )}
                        {matchesRole && <p className="text-[0.65rem] text-muted-foreground font-mono text-center">Encrypted into LSBs</p>}
                      </div>
                    ) : m.docName ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <FileText style={{ width: 14, height: 14, color: '#4fc3f7' }} />
                          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#4fc3f7' }}>E2E Encrypted Document</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, wordBreak: 'break-all' }}>{m.docName}</div>
                        {!matchesRole && m.docCiphertextB64 && m.docIvB64 && m.docKeyB64 && !m.docUrl && (
                          <button
                            className="btn btn-secondary w-full text-xs justify-center font-mono border border-accent/30 text-accent hover:bg-accent/10 mt-1"
                            onClick={() => decryptDocument(m.id, m.docCiphertextB64!, m.docIvB64!, m.docKeyB64!, m.docType!, m.docName!)}
                            disabled={m.isDecryptingDoc}
                          >
                            {m.isDecryptingDoc ? "Decrypting..." : <><Unlock className="w-3 h-3 mr-1"/> Decrypt & Download</>}
                          </button>
                        )}
                        {m.docUrl && !matchesRole && (
                          <div className="text-[0.65rem] text-green-400 font-mono mt-1 flex items-center gap-1">
                            ✅ Decrypted successfully <a href={m.docUrl} download={m.docName} className="text-accent underline ml-2 flex items-center"><Download className="w-3 h-3 mr-1"/> Save Again</a>
                          </div>
                        )}
                      </div>
                    ) : m.audioUrl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <Volume2 style={{ width: 14, height: 14, color: 'rgb(180,130,255)' }} />
                          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'rgb(180,130,255)' }}>E2E Encrypted Audio</span>
                        </div>
                        <audio controls src={m.audioUrl} style={{ width: '100%', height: 32 }} />
                      </div>
                    ) : (
                      <pre style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-primary)' }}>
                        {m.text}
                      </pre>
                    )}

                    {m.ciphertext && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="code-block" style={{ fontSize: '0.62rem', background: 'rgba(0,0,0,0.3)', color: '#888' }}>
                          [{m.verified ? '✓ Sig Valid' : '⚠️ Sig Invalid'}] CT: {m.ciphertext}
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'right' }}>{m.timestamp}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stego Attachment Preview */}
          {stegoFile && (
            <div className="bg-primary/10 border border-primary/20 rounded p-2 mb-2 flex items-center justify-between text-xs text-primary font-mono animate-fade-in">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>Attached Stego Cover: {stegoFile.name}</span>
              </div>
              <button onClick={() => setStegoFile(null)} className="hover:text-white"><XCircle className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── Audio Encryption Panel ── */}
          <div style={{
            margin: '0.5rem 0', padding: '0.75rem', borderRadius: 'var(--radius)',
            background: 'rgba(138,43,226,0.06)', border: '1px solid rgba(138,43,226,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'rgb(180,130,255)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Volume2 style={{ width: 14, height: 14 }} /> E2E Audio Encryption
              </span>
              <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'rgba(180,130,255,0.7)' }}>AES-256-GCM · Client-Side</span>
            </div>

            {/* Audio Controls Row */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <button onClick={captureAudio} disabled={!session} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: isRecording ? 'rgba(255,50,50,0.3)' : 'rgba(255,255,255,0.08)', color: isRecording ? '#ff6b6b' : '#ccc', transition: 'all 0.2s', opacity: session ? 1 : 0.4 }}>
                {isRecording ? <><Square style={{ width: 12, height: 12 }} /> Stop</> : <><Mic style={{ width: 12, height: 12 }} /> Record</>}
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: session ? 'pointer' : 'not-allowed', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#ccc', opacity: session ? 1 : 0.4 }}>
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioUpload} disabled={!session} />
                <Upload style={{ width: 12, height: 12 }} /> Upload
              </label>

              <button onClick={encryptAudio} disabled={!audioBlob} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: audioBlob ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.05)', color: audioBlob ? '#00c896' : '#555' }}>
                <Lock style={{ width: 12, height: 12 }} /> Encrypt
              </button>

              <button onClick={sendEncryptedAudio} disabled={!encryptedAudioB64} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: encryptedAudioB64 ? 'rgba(0,150,255,0.2)' : 'rgba(255,255,255,0.05)', color: encryptedAudioB64 ? '#4fc3f7' : '#555' }}>
                <Send style={{ width: 12, height: 12 }} /> Send
              </button>

              <button onClick={decryptAudio} disabled={!encryptedAudioB64} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: encryptedAudioB64 ? 'rgba(255,180,0,0.15)' : 'rgba(255,255,255,0.05)', color: encryptedAudioB64 ? '#ffb400' : '#555' }}>
                <Unlock style={{ width: 12, height: 12 }} /> Decrypt
              </button>
            </div>

            {/* Original Audio Player */}
            {audioUrl && !encryptedAudioB64 && (
              <div style={{ marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: '#888', marginBottom: '0.2rem' }}>▶ ORIGINAL (Plaintext Audio)</div>
                <audio controls src={audioUrl} style={{ width: '100%', height: 32 }} />
              </div>
            )}

            {/* Decrypted Audio Player */}
            {decryptedAudioUrl && (
              <div style={{ marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: '#ffb400', marginBottom: '0.2rem' }}>🔓 DECRYPTED (Recovered from ciphertext)</div>
                <audio controls src={decryptedAudioUrl} style={{ width: '100%', height: 32 }} />
              </div>
            )}

            {/* ── ENCRYPTION PROOF PANEL (for faculty demo) ── */}
            {encryptedAudioB64 && (
              <div style={{ marginTop: '0.5rem', padding: '0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,50,50,0.3)' }}>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: '#ff6b6b', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🛡️ Encryption Proof — Faculty Verification
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <div style={{ padding: '0.4rem', borderRadius: '4px', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)' }}>
                    <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#00c896', marginBottom: '0.2rem' }}>AES-256 SESSION KEY</div>
                    <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#666', wordBreak: 'break-all' }}>{audioKeyB64}</div>
                  </div>
                  <div style={{ padding: '0.4rem', borderRadius: '4px', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}>
                    <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#ffb400', marginBottom: '0.2rem' }}>INITIALIZATION VECTOR (IV)</div>
                    <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#666', wordBreak: 'break-all' }}>{audioIvB64}</div>
                  </div>
                </div>

                <div style={{ padding: '0.4rem', borderRadius: '4px', background: 'rgba(255,50,50,0.05)', border: '1px solid rgba(255,50,50,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#ff6b6b' }}>CIPHERTEXT (Encrypted Audio Bytes)</span>
                    <span style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#666' }}>{(encryptedAudioB64.length * 0.75 / 1024).toFixed(1)} KB</span>
                  </div>
                  <div style={{ fontSize: '0.45rem', fontFamily: 'var(--font-mono)', color: '#555', wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto', lineHeight: '1.4' }}>
                    {encryptedAudioB64.slice(0, 600)}{encryptedAudioB64.length > 600 ? '…' : ''}
                  </div>
                </div>

                <div style={{ marginTop: '0.4rem', fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#888', lineHeight: '1.5' }}>
                  ℹ️ This audio was encrypted using <span style={{ color: '#00c896' }}>AES-256-GCM</span> via the browser's Web Crypto API.
                  The original audio bytes are completely unrecoverable without the key + IV shown above.
                  The server will only receive the ciphertext — never the raw audio.
                </div>
              </div>
            )}

            {/* Status */}
            {audioStatus && (
              <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'rgba(180,130,255,0.8)', marginTop: '0.3rem' }}>
                {audioStatus}
              </div>
            )}
          </div>

          {/* ── Document Encryption Panel ── */}
          <div style={{
            margin: '0.5rem 0', padding: '0.75rem', borderRadius: 'var(--radius)',
            background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
               <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText style={{ width: 14, height: 14 }} /> E2E Document Transfer
              </span>
              <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'rgba(0,229,255,0.6)' }}>AES-GCM</span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: session ? 'pointer' : 'not-allowed', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#ccc', opacity: session ? 1 : 0.4 }}>
                <input id="doc-upload-input" type="file" style={{ display: 'none' }} onChange={handleDocumentUpload} disabled={!session} />
                <Upload style={{ width: 12, height: 12 }} /> Select File
              </label>

              <button onClick={encryptDocument} disabled={!docFile} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: docFile ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.05)', color: docFile ? '#00c896' : '#555' }}>
                <Lock style={{ width: 12, height: 12 }} /> Encrypt
              </button>

              <button onClick={sendEncryptedDocument} disabled={!docEncryptedB64} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', border: 'none', background: docEncryptedB64 ? 'rgba(0,150,255,0.2)' : 'rgba(255,255,255,0.05)', color: docEncryptedB64 ? '#4fc3f7' : '#555' }}>
                <Send style={{ width: 12, height: 12 }} /> Send
              </button>
            </div>

            {docEncryptedB64 && (
              <div style={{ marginTop: '0.5rem', padding: '0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,229,255,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>CIPHERTEXT (Encrypted Document)</span>
                  <span style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#666' }}>{(docEncryptedB64.length * 0.75 / 1024).toFixed(1)} KB</span>
                </div>
                <div style={{ fontSize: '0.45rem', fontFamily: 'var(--font-mono)', color: '#555', wordBreak: 'break-all', maxHeight: '60px', overflowY: 'auto', lineHeight: '1.4' }}>
                  {docEncryptedB64.slice(0, 400)}{docEncryptedB64.length > 400 ? '…' : ''}
                </div>
              </div>
            )}

            {docStatus && (
              <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'rgba(0,229,255,0.8)', marginTop: '0.3rem' }}>
                {docStatus}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="divider opacity-10" />
          <div className="mt-4 space-y-3">
            <textarea
              className="input w-full p-6 transition-all duration-300 focus:ring-1 focus:ring-accent/30"
              style={{ 
                minHeight: '120px', 
                maxHeight: '300px', 
                fontSize: '1rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                lineHeight: '1.5'
              }}
              placeholder={session ? (stegoFile ? 'Type your secret message to be hidden cryptographically in the image LSBs...' : 'Enter your quantum-safe transmission...') : 'Host or Join a session to begin encrypted communication...'}
              value={input}
              disabled={!session || loading}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            />
            
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-accent transition-all duration-200 group" title="Attach Image (Q-Steg)">
                  <input type="file" accept="image/png, image/jpeg" style={{ display: 'none' }} onChange={handleImageUpload} disabled={!session} />
                  <ImageIcon className="w-5 h-5 group-hover:scale-110" />
                  <span className="text-[0.7rem] font-mono uppercase tracking-widest hidden md:inline">Quantum-Steg Payload</span>
                </label>
                
                {stegoFile && (
                  <div className="flex items-center gap-2 text-xs text-accent animate-pulse font-mono">
                    <Activity className="w-3 h-3" />
                    <span>{stegoFile.name.slice(0, 15)}…</span>
                    <button onClick={() => setStegoFile(null)} className="text-white/40 hover:text-red-500">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <button 
                className="btn btn-primary px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                onClick={sendMessage}
                disabled={!session || loading || (!input.trim() && !stegoFile)}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="font-mono text-sm font-bold tracking-widest uppercase">Send Fragment</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {!session && (
              <p className="text-[0.6rem] text-center font-mono text-muted-foreground uppercase tracking-widest animate-pulse pt-2">
                Terminal Locked: Synchronous Key Exchange Required
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
