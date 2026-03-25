import { useNavigate } from 'react-router-dom'

const features = [
  {
    icon: '🔷',
    title: 'CRYSTALS-Kyber',
    subtitle: 'Lattice-based KEM',
    desc: 'NIST PQC winner. M-LWE hardness. IND-CCA2 secure. 1568-byte public key.',
    color: 'cyan',
  },
  {
    icon: '📡',
    title: 'Classic McEliece',
    subtitle: 'Code-based KEM',
    desc: '50-year security track record. Goppa codes. Largest public key, hardest to break.',
    color: 'violet',
  },
  {
    icon: '✍️',
    title: 'SPHINCS+',
    subtitle: 'Hash-based Signature',
    desc: 'Stateless. No secret state. Hash-based security. NIST finalist.',
    color: 'green',
  },
  {
    icon: '⚛️',
    title: 'Quantum QRNG',
    subtitle: 'Quantum Randomness',
    desc: 'Hadamard circuits on Qiskit. Measurement collapse. True unpredictability.',
    color: 'amber',
  },
  {
    icon: '🔑',
    title: 'HKDF Fusion',
    subtitle: 'Multi-Secret Derivation',
    desc: 'Kyber ‖ McEliece ‖ QRNG → HKDF-SHA256 → one 256-bit session key.',
    color: 'cyan',
  },
  {
    icon: '🛡️',
    title: 'AES-256-GCM',
    subtitle: 'Symmetric Encryption',
    desc: 'Authenticated encryption. 16-byte GCM tag ensures tamper detection.',
    color: 'violet',
  },
]

const steps = [
  { num: '01', label: 'Start Session', desc: 'Client triggers hybrid key generation' },
  { num: '02', label: 'PQC Keygen', desc: 'Kyber + McEliece + SPHINCS+ in parallel threads' },
  { num: '03', label: 'Quantum Entropy', desc: 'Qiskit QRNG contributes true random bits' },
  { num: '04', label: 'HKDF Fusion', desc: 'All secrets fused into one 256-bit session key' },
  { num: '05', label: 'Encrypt & Sign', desc: 'AES-256-GCM encrypts; SPHINCS+ signs' },
  { num: '06', label: 'Verify & Decrypt', desc: 'Signature verified; message recovered' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="page">
      {/* ── Hero ── */}
      <section style={{ padding: '5rem 0 3rem', textAlign: 'center', position: 'relative' }}>
        {/* Glow orbs */}
        <div style={{
          position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container animate-fade-in">
          <div className="flex flex-center gap-2 mb-2">
            <span className="badge badge-cyan"><span className="dot" />NIST PQC Algorithms Active</span>
            <span className="badge badge-violet"><span className="dot" />Qiskit Quantum Layer</span>
          </div>

          <h1 style={{ marginBottom: '1rem' }}>
            <span className="gradient-text">Schrödinger's Box</span>
          </h1>

          <p style={{ fontSize: '1.15rem', maxWidth: '640px', margin: '0 auto 2rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Post-quantum secure. Quantum-enhanced. The first platform that combines
            lattice, code-based, and hash-based cryptography with real quantum entropy
            into one hybrid session key.
          </p>

          <div className="flex flex-center gap-2 flex-wrap">
            <button className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.8rem 2rem' }}
              onClick={() => navigate('/chat')}>
              ⚡ Start Secure Session
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
              View Dashboard →
            </button>
          </div>

          {/* Mini stats row */}
          <div className="flex flex-center gap-3 flex-wrap mt-4"
            style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <span>3 × PQC algorithms</span>
            <span style={{ color: 'var(--border)' }}>│</span>
            <span>256-bit AES-GCM</span>
            <span style={{ color: 'var(--border)' }}>│</span>
            <span>HKDF-SHA256</span>
            <span style={{ color: 'var(--border)' }}>│</span>
            <span>Qiskit QRNG + BB84</span>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section style={{ padding: '2rem 0' }} className="container">
        <p className="section-label" style={{ textAlign: 'center' }}>Algorithm Stack</p>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Six layers of <span className="gradient-text">quantum-safe protection</span>
        </h2>
        <div className="grid-3">
          {features.map(f => (
            <div key={f.title} className={`card violet animate-fade-in`}
              style={{ borderColor: f.color === 'cyan' ? 'var(--border)' : f.color === 'violet' ? 'var(--border-violet)' : 'rgba(0,255,136,0.15)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>{f.icon}</div>
              <div style={{ marginBottom: '0.25rem' }}>
                <h3 style={{ marginBottom: '0.1rem' }}>{f.title}</h3>
                <span className={`badge badge-${f.color}`} style={{ fontSize: '0.68rem' }}>{f.subtitle}</span>
              </div>
              <p style={{ fontSize: '0.875rem', marginTop: '0.6rem' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Protocol Flow ── */}
      <section style={{ padding: '3rem 0' }} className="container">
        <p className="section-label" style={{ textAlign: 'center' }}>Protocol Flow</p>
        <h2 style={{ textAlign: 'center', marginBottom: '2.5rem' }}>How a secure session works</h2>

        <div className="grid-3 gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="card animate-fade-in"
              style={{ animationDelay: `${i * 0.08}s`, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700,
                color: 'var(--cyan)', opacity: 0.5, lineHeight: 1, flex: '0 0 auto',
              }}>{s.num}</div>
              <div>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>{s.label}</h3>
                <p style={{ fontSize: '0.8rem' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Judge Impact ── */}
      <section style={{ padding: '2rem 0 4rem' }} className="container">
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(0,229,255,0.05), rgba(168,85,247,0.05))',
          border: '1px solid rgba(168,85,247,0.2)',
          textAlign: 'center', padding: '2.5rem',
        }}>
          <h2 style={{ marginBottom: '1rem' }}>Why This Matters</h2>
          <p style={{ maxWidth: '640px', margin: '0 auto 1.5rem', fontSize: '0.95rem', lineHeight: 1.8 }}>
            Harvest-now-decrypt-later attacks are real. Nation-state adversaries are storing encrypted
            traffic today to decrypt it once quantum computers mature. Schrödinger's Box is the
            countermeasure — classical computers cannot break it; quantum computers cannot break it.
          </p>
          <div className="flex flex-center gap-2 flex-wrap">
            <span className="badge badge-green">✓ Harvest-Now-Decrypt-Later Resistant</span>
            <span className="badge badge-cyan">✓ No Single Point of Failure</span>
            <span className="badge badge-violet">✓ Quantum Entropy Injected</span>
          </div>
        </div>
      </section>
    </div>
  )
}
