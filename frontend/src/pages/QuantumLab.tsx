import React, { useState } from 'react';
import { Play, Terminal, FlaskConical, AlertTriangle, CheckCircle2, ChevronRight, Eye, Cpu, Zap } from 'lucide-react';
import { simulateQasm, fetchBB84, type BB84Response } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const GROVER_SEARCH_QASM = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];

// Initialize superposition
h q[0];
h q[1];

// Oracle (marks state |11>)
cz q[0], q[1];

// Amplification (Diffusion operator)
h q[0];
h q[1];
z q[0];
z q[1];
cz q[0], q[1];
h q[0];
h q[1];

// Measure
measure q[0] -> c[0];
measure q[1] -> c[1];
`;

const BELL_STATE_QASM = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];

// Create entanglement
h q[0];
cx q[0], q[1];

// Measure
measure q[0] -> c[0];
measure q[1] -> c[1];
`;

const QUANTUM_LAB_QASM = `// Write your custom OPENQASM 2.0 code here
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];

h q[0];
cx q[0], q[1];
cx q[1], q[2];

measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];
`;

// ── BB84 Bit Stream Table ──────────────────────────────────────────────────
function BB84Viz({ data }: { data: BB84Response }) {
  const bits = data.alice_bits_preview.slice(0, 16);
  const aBase = data.alice_bases_preview.slice(0, 16);
  const bBase = data.bob_bases_preview.slice(0, 16);
  const match = data.basis_match_preview.slice(0, 16);

  const cell: React.CSSProperties = { padding: '0.35rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' };
  const hcell: React.CSSProperties = { ...cell, color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600 };

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...hcell, textAlign: 'left', width: '7rem' }}>Row</th>
            {bits.map((_, i) => <th key={i} style={hcell}>{i + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: 'rgba(0,229,255,0.03)' }}>
            <td style={{ ...cell, color: 'var(--cyan)', fontWeight: 700 }}>Alice bit</td>
            {bits.map((b, i) => <td key={i} style={cell}>{b}</td>)}
          </tr>
          <tr>
            <td style={{ ...cell, color: '#a855f7', fontWeight: 700 }}>Alice basis</td>
            {aBase.map((b, i) => <td key={i} style={{ ...cell, color: '#a855f7' }}>{b}</td>)}
          </tr>
          <tr style={{ background: 'rgba(0,255,136,0.03)' }}>
            <td style={{ ...cell, color: 'var(--green)', fontWeight: 700 }}>Bob basis</td>
            {bBase.map((b, i) => <td key={i} style={{ ...cell, color: 'var(--green)' }}>{b}</td>)}
          </tr>
          <tr>
            <td style={{ ...cell, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Match</td>
            {match.map((m, i) => (
              <td key={i} style={{ ...cell, fontWeight: 'bold', color: m ? 'var(--green)' : 'var(--red)' }}>
                {m ? '✓' : '✗'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function QuantumLab({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [qasmCode, setQasmCode] = useState(QUANTUM_LAB_QASM);
  const [shots, setShots] = useState(1024);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [bb84, setBB84] = useState<BB84Response | null>(null);
  const [eveMode, setEveMode] = useState(false);
  const [isSimulatingBB84, setIsSimulatingBB84] = useState(false);

  const runSimulation = async () => {
    setIsRunning(true); setError(null); setResult(null);
    try {
      const res = await simulateQasm(qasmCode, shots);
      if (res.success) setResult(res);
      else setError(res.error || 'Simulation failed.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Network error');
    } finally { setIsRunning(false); }
  };

  const simulateBB84 = async () => {
    setIsSimulatingBB84(true);
    try { setBB84(await fetchBB84(100, eveMode)); }
    catch (e) { console.error(e); }
    setIsSimulatingBB84(false);
  };

  const chartData = result?.counts
    ? Object.keys(result.counts).map(key => ({
        state: `|${key}⟩`,
        probability: (result.counts[key] / shots) * 100,
        count: result.counts[key]
      })).sort((a, b) => b.probability - a.probability)
    : [];

  const lines = qasmCode.split('\n');

  const panel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px', backdropFilter: 'blur(12px)', overflow: 'hidden'
  };

  return (
    <div style={{ padding: isEmbedded ? '2rem' : '3rem 2.5rem', maxWidth: isEmbedded ? undefined : '1200px', margin: isEmbedded ? undefined : '0 auto' }}
      className="animate-fade-in">

      {/* Standalone header */}
      {!isEmbedded && (
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)',
            padding: '0.5rem 1.25rem', borderRadius: '999px',
            border: '1px solid rgba(0,229,255,0.2)', marginBottom: '1rem',
            fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase'
          }}>
            <FlaskConical style={{ width: 14, height: 14 }} /> Threat Simulator &amp; Sandbox
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '0.75rem' }}>Quantum <span style={{ color: 'var(--cyan)' }}>Lab</span></h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
            Write custom OPENQASM 2.0 circuits or simulate quantum cryptographic protocols like BB84 QKD.
          </p>
        </header>
      )}

      {/* ── BB84 Panel ── */}
      <div style={{ ...panel, marginBottom: '1.5rem', position: 'relative' }}>
        {/* Top glow strip */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #7c3aed, #00e5ff)', position: 'absolute', top: 0, left: 0, right: 0 }} />

        <div style={{ padding: '1.5rem 1.75rem', paddingTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Eye style={{ width: 18, height: 18 }} /> BB84 Quantum Key Distribution
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Live simulation of quantum state polarization and No-Cloning eavesdrop detection
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setEveMode(!eveMode); setBB84(null); }}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: '10px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600,
                  background: eveMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                  color: eveMode ? '#f87171' : 'var(--text-muted)',
                  border: eveMode ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                {eveMode ? '👁 Eve Active' : 'Simulate Eavesdropper'}
              </button>
              <button
                onClick={simulateBB84}
                disabled={isSimulatingBB84}
                style={{
                  padding: '0.55rem 1.25rem', borderRadius: '10px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                  color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  opacity: isSimulatingBB84 ? 0.7 : 1, transition: 'all 0.2s',
                  boxShadow: '0 0 20px rgba(124,58,237,0.25)'
                }}
              >
                <Zap style={{ width: 14, height: 14 }} />
                {isSimulatingBB84 ? 'Simulating...' : 'Generate Quantum Key'}
              </button>
            </div>
          </div>

          {bb84 ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                <span style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', color: 'var(--cyan)', padding: '0.3rem 0.85rem', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {bb84.n_bits_transmitted} bits transmitted
                </span>
                <span style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7', padding: '0.3rem 0.85rem', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  Sifted key: {bb84.sifted_key_length} bits
                </span>
                <span style={{
                  background: bb84.eve_detected ? 'rgba(239,68,68,0.12)' : 'rgba(0,255,136,0.08)',
                  border: `1px solid ${bb84.eve_detected ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,136,0.2)'}`,
                  color: bb84.eve_detected ? '#f87171' : 'var(--green)',
                  padding: '0.3rem 0.85rem', borderRadius: '8px',
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}>
                  {bb84.eve_detected ? <AlertTriangle style={{ width: 13, height: 13 }} /> : <CheckCircle2 style={{ width: 13, height: 13 }} />}
                  QBER: {(bb84.qber * 100).toFixed(1)}% — {bb84.eve_detected ? '⚠ COMPROMISED' : 'SECURE'}
                </span>
              </div>
              <BB84Viz data={bb84} />
              {bb84.eve_detected && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1.1rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#f87171', lineHeight: 1.6 }}>
                  ⚠ Eve intercepted the transmission! The No-Cloning theorem forced wavefunction collapse, statistically corrupting Alice's polarization bases and raising the QBER beyond the 25% detection threshold.
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(168,85,247,0.15)', borderRadius: '12px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click "Generate Quantum Key" to execute the photon stream</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Editor + Results 2-col ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Left: QASM Editor */}
        <div style={panel}>
          {/* Editor header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)' }}>
              <Terminal style={{ width: 15, height: 15 }} /> OPENQASM 2.0 Editor
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: 'Bell State', code: BELL_STATE_QASM, color: 'var(--cyan)' },
                { label: "Grover's Search", code: GROVER_SEARCH_QASM, color: '#a855f7' },
              ].map(({ label, code, color }) => (
                <button key={label} onClick={() => setQasmCode(code)} style={{
                  padding: '0.3rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600,
                  background: `rgba(${color === 'var(--cyan)' ? '0,229,255' : '168,85,247'},0.08)`,
                  color, border: `1px solid ${color === 'var(--cyan)' ? 'rgba(0,229,255,0.2)' : 'rgba(168,85,247,0.2)'}`,
                  transition: 'all 0.2s'
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* IDE body */}
          <div style={{ display: 'flex', background: '#0d1117', minHeight: '380px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            <div style={{ width: '2.8rem', padding: '1rem 0.6rem 1rem 0', background: '#0d1117', borderRight: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.18)', textAlign: 'right', userSelect: 'none', lineHeight: '1.55', flexShrink: 0 }}>
              {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              value={qasmCode}
              onChange={e => setQasmCode(e.target.value)}
              spellCheck={false}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#7ee787', padding: '1rem', lineHeight: '1.55', resize: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
            />
          </div>

          {/* Shots + Execute */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.4rem 0.9rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shots:</span>
              <input type="number" value={shots} onChange={e => setShots(Number(e.target.value))} min={1} max={8192}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', width: '4rem' }} />
            </div>
            <button
              onClick={runSimulation}
              disabled={isRunning || !qasmCode.trim()}
              style={{
                flex: 1, padding: '0.55rem', borderRadius: '10px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700,
                background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)',
                border: '1px solid rgba(0,229,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: isRunning ? 0.6 : 1, transition: 'all 0.2s',
                boxShadow: isRunning ? 'none' : '0 0 14px rgba(0,229,255,0.1)'
              }}
            >
              {isRunning
                ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,229,255,0.2)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <Play style={{ width: 14, height: 14 }} />}
              {isRunning ? 'Executing...' : 'EXECUTE CIRCUIT'}
            </button>
          </div>
        </div>

        {/* Right: Results Panel */}
        <div style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)' }}>
            <ChevronRight style={{ width: 15, height: 15 }} /> Measurement Results
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.5rem' }}>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '1rem', display: 'flex', gap: '0.75rem', color: '#f87171' }}>
                <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Execution Error</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', opacity: 0.8 }}>{error}</p>
                </div>
              </div>
            )}

            {!result && !error && !isRunning && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35, gap: '0.75rem' }}>
                <FlaskConical style={{ width: 56, height: 56, color: 'var(--text-muted)' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Awaiting quantum execution...</p>
              </div>
            )}

            {isRunning && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,229,255,0.15)', borderRadius: '50%', filter: 'blur(12px)' }} />
                  <div style={{ width: 64, height: 64, border: '3px solid rgba(0,229,255,0.15)', borderTopColor: 'var(--cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <Cpu style={{ width: 22, height: 22, color: 'var(--cyan)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--cyan)' }} className="animate-pulse">Running on AerSimulator...</p>
              </div>
            )}

            {result && !isRunning && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Circuit Qubits', value: result.qubits },
                    { label: 'Circuit Depth', value: result.depth },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--cyan)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Probability Distribution ({result.shots} shots)
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                      <XAxis dataKey="state" stroke="rgba(255,255,255,0.15)" tick={{ fill: '#8892b0', fontSize: 11, fontFamily: 'monospace' }} tickMargin={8} />
                      <YAxis stroke="rgba(255,255,255,0.15)" tickFormatter={v => v + '%'} tick={{ fill: '#8892b0', fontSize: 11 }} width={36} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,229,255,0.06)' }}
                        contentStyle={{ backgroundColor: '#0a1628', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}
                        formatter={(v: number) => [v.toFixed(1) + '%', 'Probability']}
                        labelStyle={{ color: 'var(--cyan)', fontWeight: 700 }}
                      />
                      <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? '#00e5ff' : '#3b82f6'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
