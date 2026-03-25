import { useState } from 'react'
import QuantumLab from './QuantumLab'
import AlgorithmAnalyzer from './AlgorithmAnalyzer'
import { Activity, ShieldAlert, Cpu } from 'lucide-react'

export default function ThreatIntelligence() {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'lab'>('analyzer');

  return (
    <div className="page animate-fade-in">
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 2.5rem 5rem' }}>

        {/* ── Header ── */}
        <header style={{ textAlign: 'center', paddingBottom: '2.5rem', paddingTop: '1rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(239,68,68,0.1)', color: '#f87171',
            padding: '0.5rem 1.25rem', borderRadius: '999px',
            border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.25rem',
            fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>
            <Activity style={{ width: 14, height: 14 }} />
            Global Threat Command Center
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.1 }}>
            Quantum <span style={{ color: '#ef4444' }}>Security</span> Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
            Monitor your hybrid network, assess legacy vulnerabilities, and simulate real-time QASM attacks from a single unified workspace.
          </p>
        </header>

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', flexDirection: 'row', gap: '0.35rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '0.3rem'
          }}>
            <button
              onClick={() => setActiveTab('analyzer')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.5rem', borderRadius: '10px',
                fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: activeTab === 'analyzer' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: activeTab === 'analyzer' ? '#f87171' : 'var(--text-muted)',
                border: activeTab === 'analyzer' ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
                boxShadow: activeTab === 'analyzer' ? '0 0 16px rgba(239,68,68,0.12)' : 'none'
              }}
            >
              <ShieldAlert style={{ width: 15, height: 15 }} />
              AST Algorithm Analyzer
            </button>
            <button
              onClick={() => setActiveTab('lab')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.5rem', borderRadius: '10px',
                fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: activeTab === 'lab' ? 'rgba(0,229,255,0.1)' : 'transparent',
                color: activeTab === 'lab' ? 'var(--cyan)' : 'var(--text-muted)',
                border: activeTab === 'lab' ? '1px solid rgba(0,229,255,0.2)' : '1px solid transparent',
                boxShadow: activeTab === 'lab' ? '0 0 16px rgba(0,229,255,0.1)' : 'none'
              }}
            >
              <Cpu style={{ width: 15, height: 15 }} />
              QASM Threat Sandbox
            </button>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden'
        }}>
          {activeTab === 'analyzer' && <AlgorithmAnalyzer isEmbedded={true} />}
          {activeTab === 'lab' && <QuantumLab isEmbedded={true} />}
        </div>

      </div>
    </div>
  )
}
