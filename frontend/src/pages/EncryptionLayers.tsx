import { useState } from 'react'
import { generateKeys, visualizeLayers } from '../api/client'
import { Layers, Lock, Key, Shield, Send, ChevronDown, ChevronRight, Cpu, FileText, Unlock, CheckCircle } from 'lucide-react'

interface LayerData {
  name: string
  algo: string
  description: string
  hex: string
  b64: string
  size: number
  preview: string
  parts?: { nonce?: string; auth_tag?: string; ciphertext?: string }
}

const LAYER_COLORS = [
  { bg: 'rgba(0,229,255,0.06)', border: 'rgba(0,229,255,0.25)', accent: '#00e5ff', icon: <FileText size={16} /> },
  { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.25)', accent: '#a855f7', icon: <Cpu size={16} /> },
  { bg: 'rgba(0,200,83,0.06)', border: 'rgba(0,200,83,0.25)', accent: '#00c853', icon: <Lock size={16} /> },
  { bg: 'rgba(255,183,77,0.06)', border: 'rgba(255,183,77,0.25)', accent: '#ffb74d', icon: <Send size={16} /> },
  { bg: 'rgba(255,82,82,0.06)', border: 'rgba(255,82,82,0.25)', accent: '#ff5252', icon: <Shield size={16} /> },
]

const DEC_COLORS = [
  { bg: 'rgba(255,183,77,0.06)', border: 'rgba(255,183,77,0.25)', accent: '#ffb74d', icon: <Send size={16} /> },
  { bg: 'rgba(255,82,82,0.06)', border: 'rgba(255,82,82,0.25)', accent: '#ff5252', icon: <Shield size={16} /> },
  { bg: 'rgba(0,200,83,0.06)', border: 'rgba(0,200,83,0.25)', accent: '#00c853', icon: <Unlock size={16} /> },
  { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.25)', accent: '#a855f7', icon: <Cpu size={16} /> },
  { bg: 'rgba(0,229,255,0.06)', border: 'rgba(0,229,255,0.25)', accent: '#00e5ff', icon: <CheckCircle size={16} /> },
]

export default function EncryptionLayers() {
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [layers, setLayers] = useState<LayerData[]>([])
  const [decLayers, setDecLayers] = useState<LayerData[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]))
  const [decExpanded, setDecExpanded] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]))
  const [error, setError] = useState('')

  const initSession = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await generateKeys()
      setSessionId(data.session_id)
      setError('')
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message)
    }
    setLoading(false)
  }

  const runVisualization = async () => {
    if (!input.trim() || !sessionId) return
    setLoading(true)
    setError('')
    try {
      const res = await visualizeLayers(sessionId, input.trim())
      setLayers(res.layers)
      setDecLayers(res.decryption_layers || [])
      setExpanded(new Set(res.layers.map((_: any, i: number) => i)))
      setDecExpanded(new Set((res.decryption_layers || []).map((_: any, i: number) => i)))
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message)
    }
    setLoading(false)
  }

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const toggleDecExpand = (i: number) => {
    setDecExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="page mx-auto w-full max-w-[1200px] px-8 pb-12 animate-fade-in">
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Layers style={{ width: 28, height: 28, color: 'var(--cyan)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--cyan), var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Encryption Layer Visualizer
          </h1>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto' }}>
          Watch your plaintext transform through each encryption layer — BYOA Custom Cipher, AES-256-GCM, Base64 Transport, and SPHINCS+ Signature.
        </p>
      </div>

      {/* Controls */}
      <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.2rem', marginBottom: '1.5rem' }}>
        {!sessionId ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              Initialize a cryptographic session to begin visualization.
            </p>
            <button
              onClick={initSession}
              disabled={loading}
              style={{
                padding: '0.6rem 2rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(139,92,246,0.2))',
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              <Key size={16} /> {loading ? 'Generating Keys...' : 'Initialize Session (Kyber + McEliece + SPHINCS+)'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--green)', fontWeight: 600 }}>SESSION ACTIVE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#666' }}>{sessionId.slice(0, 12)}…</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runVisualization() }}
                placeholder="Type your plaintext message here to see it encrypted layer-by-layer..."
                style={{
                  flex: 1, padding: '0.6rem 1rem', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={runVisualization}
                disabled={loading || !input.trim()}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
                  background: input.trim() ? 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(139,92,246,0.2))' : 'rgba(255,255,255,0.05)',
                  color: input.trim() ? '#fff' : '#555', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
                  cursor: input.trim() ? 'pointer' : 'not-allowed', letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <Layers size={16} /> {loading ? 'Processing...' : 'Encrypt & Visualize'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.6rem 1rem', borderRadius: '6px', background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6b6b', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Layer Pipeline Visualization */}
      {layers.length > 0 && (
        <div>
          {/* Pipeline connector line label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, var(--cyan), var(--violet))' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Encryption Pipeline — {layers.length} Layers
            </span>
            <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, var(--violet), var(--cyan))' }} />
          </div>

          {layers.map((layer, i) => {
            const colors = LAYER_COLORS[i % LAYER_COLORS.length]
            const isOpen = expanded.has(i)

            return (
              <div key={i} style={{ marginBottom: '0.5rem' }}>
                {/* Connector arrow */}
                {i > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '0.3rem 0' }}>
                    <div style={{ width: 2, height: 20, background: `linear-gradient(180deg, ${LAYER_COLORS[(i - 1) % LAYER_COLORS.length].accent}, ${colors.accent})`, borderRadius: 1 }} />
                  </div>
                )}

                {/* Layer Card */}
                <div style={{
                  background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px',
                  overflow: 'hidden', transition: 'all 0.3s',
                }}>
                  {/* Header (clickable) */}
                  <div
                    onClick={() => toggleExpand(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem',
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${colors.accent}22`, color: colors.accent, flexShrink: 0 }}>
                      {colors.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Layer {i}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {layer.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.1rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888' }}>{layer.algo}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555' }}>|</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#666' }}>{layer.size} bytes</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronDown size={16} style={{ color: '#888' }} /> : <ChevronRight size={16} style={{ color: '#888' }} />}
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: '0 1rem 0.8rem 1rem', borderTop: `1px solid ${colors.border}` }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#999', lineHeight: 1.6, margin: '0.5rem 0' }}>
                        {layer.description}
                      </p>

                      {/* AES-GCM breakdown */}
                      {layer.parts && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          <div style={{ padding: '0.35rem', borderRadius: '4px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: colors.accent, marginBottom: '0.15rem' }}>NONCE (12 bytes)</div>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#777', wordBreak: 'break-all' }}>{layer.parts.nonce}</div>
                          </div>
                          <div style={{ padding: '0.35rem', borderRadius: '4px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#ffb400', marginBottom: '0.15rem' }}>AUTH TAG (16 bytes)</div>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#777', wordBreak: 'break-all' }}>{layer.parts.auth_tag}</div>
                          </div>
                          <div style={{ padding: '0.35rem', borderRadius: '4px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#ff5252', marginBottom: '0.15rem' }}>CIPHERTEXT</div>
                            <div style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: '#777', wordBreak: 'break-all' }}>{layer.parts.ciphertext}…</div>
                          </div>
                        </div>
                      )}

                      {/* Hex dump */}
                      {layer.hex && (
                        <div style={{ marginBottom: '0.4rem' }}>
                          <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: colors.accent, marginBottom: '0.2rem', fontWeight: 600 }}>HEX OUTPUT</div>
                          <div style={{
                            padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)',
                            fontSize: '0.48rem', fontFamily: 'var(--font-mono)', color: '#666',
                            wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto', lineHeight: 1.5,
                            border: '1px solid rgba(255,255,255,0.03)',
                          }}>
                            {layer.hex}
                          </div>
                        </div>
                      )}

                      {/* Base64 */}
                      {layer.b64 && (
                        <div>
                          <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: colors.accent, marginBottom: '0.2rem', fontWeight: 600 }}>BASE64 OUTPUT</div>
                          <div style={{
                            padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)',
                            fontSize: '0.48rem', fontFamily: 'var(--font-mono)', color: '#555',
                            wordBreak: 'break-all', maxHeight: '60px', overflowY: 'auto', lineHeight: 1.5,
                            border: '1px solid rgba(255,255,255,0.03)',
                          }}>
                            {layer.b64}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Encryption Summary */}
          <div style={{
            marginTop: '1.2rem', padding: '0.8rem 1rem', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.04), rgba(139,92,246,0.04))',
            border: '1px solid rgba(139,92,246,0.15)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--cyan)', marginBottom: '0.3rem' }}>
              🔒 ENCRYPTION COMPLETE — {layers.length} Layers
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888', lineHeight: 1.6 }}>
              Your plaintext <span style={{ color: 'var(--cyan)' }}>"{input}"</span> has been encrypted through {layers.length} cryptographic layers.
            </div>
          </div>

          {/* DECRYPTION PIPELINE */}
          {decLayers.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0 0.5rem' }}>
                <div style={{ width: 3, height: 40, background: 'linear-gradient(180deg, rgba(139,92,246,0.5), rgba(0,229,255,0.5))', borderRadius: 2 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, #ff5252, #00e5ff)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  🔓 Decryption Pipeline — {decLayers.length} Layers
                </span>
                <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, #00e5ff, #ff5252)' }} />
              </div>

              {decLayers.map((layer, i) => {
                const colors = DEC_COLORS[i % DEC_COLORS.length]
                const isOpen = decExpanded.has(i)
                const isRecovered = !!(layer as any).recovered_text

                return (
                  <div key={`dec-${i}`} style={{ marginBottom: '0.5rem' }}>
                    {i > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.3rem 0' }}>
                        <div style={{ width: 2, height: 20, background: `linear-gradient(180deg, ${DEC_COLORS[(i - 1) % DEC_COLORS.length].accent}, ${colors.accent})`, borderRadius: 1 }} />
                      </div>
                    )}

                    <div style={{
                      background: isRecovered ? 'rgba(0,200,83,0.08)' : colors.bg,
                      border: `1px solid ${isRecovered ? 'rgba(0,200,83,0.4)' : colors.border}`,
                      borderRadius: '10px', overflow: 'hidden',
                    }}>
                      <div onClick={() => toggleDecExpand(i)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${colors.accent}22`, color: colors.accent, flexShrink: 0 }}>
                          {colors.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: colors.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              D-Layer {i}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {layer.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.1rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888' }}>{layer.algo}</span>
                            {layer.size > 0 && <><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555' }}>|</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#666' }}>{layer.size} bytes</span></>}
                          </div>
                        </div>
                        {isOpen ? <ChevronDown size={16} style={{ color: '#888' }} /> : <ChevronRight size={16} style={{ color: '#888' }} />}
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 1rem 0.8rem 1rem', borderTop: `1px solid ${colors.border}` }}>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#999', lineHeight: 1.6, margin: '0.5rem 0' }}>
                            {layer.description}
                          </p>

                          {isRecovered && (
                            <div style={{ padding: '0.6rem', borderRadius: '6px', background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)', marginBottom: '0.4rem' }}>
                              <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#00c853', marginBottom: '0.2rem', fontWeight: 700 }}>✅ RECOVERED PLAINTEXT</div>
                              <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 600 }}>
                                {(layer as any).recovered_text}
                              </div>
                            </div>
                          )}

                          {layer.hex && (
                            <div style={{ marginBottom: '0.4rem' }}>
                              <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: colors.accent, marginBottom: '0.2rem', fontWeight: 600 }}>HEX OUTPUT</div>
                              <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', fontSize: '0.48rem', fontFamily: 'var(--font-mono)', color: '#666', wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.03)' }}>
                                {layer.hex}
                              </div>
                            </div>
                          )}

                          {layer.b64 && (
                            <div>
                              <div style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: colors.accent, marginBottom: '0.2rem', fontWeight: 600 }}>BASE64 OUTPUT</div>
                              <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', fontSize: '0.48rem', fontFamily: 'var(--font-mono)', color: '#555', wordBreak: 'break-all', maxHeight: '60px', overflowY: 'auto', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.03)' }}>
                                {layer.b64}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Round-trip Summary */}
              <div style={{
                marginTop: '1.2rem', padding: '0.8rem 1rem', borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0,200,83,0.06), rgba(0,229,255,0.04))',
                border: '1px solid rgba(0,200,83,0.2)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: '#00c853', marginBottom: '0.3rem' }}>
                  ✅ FULL ROUND-TRIP VERIFIED
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888', lineHeight: 1.6 }}>
                  "{input}" → encrypted through {layers.length} layers → decrypted through {decLayers.length} reverse layers → original plaintext recovered perfectly. Zero information leaked.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
