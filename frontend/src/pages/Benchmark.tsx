import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts'
import { runBenchmark, type BenchmarkResponse, type BenchmarkAlgo } from '../api/client'

const COLORS = {
  'Kyber1024':      '#00e5ff',
  'Classic-McEliece': '#a855f7',
  'SPHINCS+':       '#00ff88',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--border)', minWidth: 160 }}>
      <p style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.85rem' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: '0.8rem' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{label}</p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{value}</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unit}</p>
    </div>
  )
}

export default function Benchmark() {
  const [data, setData] = useState<BenchmarkResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const go = async () => {
    setLoading(true)
    try { setData(await runBenchmark()) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  const keygenData = data?.algorithms.map(a => ({
    name: a.algorithm.replace('Classic-McEliece', 'McEliece').replace('SPHINCS+', 'SPHINCS+'),
    'Keygen (ms)': a.keygen_ms,
    'Encap/Sign (ms)': a.encap_ms ?? a.sign_ms ?? 0,
    'Decap/Verify (ms)': a.decap_ms ?? a.verify_ms ?? 0,
  })) ?? []

  const sizeData = data?.algorithms.map(a => ({
    name: a.algorithm.replace('Classic-McEliece', 'McEliece'),
    'Public Key (B)': a.public_key_bytes,
    'Private Key (B)': a.private_key_bytes,
    'Ciphertext/Sig (B)': a.ciphertext_bytes ?? a.signature_bytes ?? 0,
  })) ?? []

  const radarData = data?.algorithms.map(a => ({
    algo: a.algorithm.replace('Classic-McEliece', 'McEliece'),
    Speed:    Math.max(0, 100 - Math.min(a.keygen_ms, 100)),
    KeySize:  Math.max(0, 100 - Math.min(a.public_key_bytes / 3000, 100)),
    Memory:   Math.max(0, 100 - a.memory_delta_kb * 0.5),
  })) ?? []

  return (
    <div className="page container animate-fade-in">
      <div className="flex-between mb-4">
        <div>
          <p className="section-label">Performance Lab</p>
          <h1 style={{ fontSize: '1.8rem' }}>Algorithm Benchmark</h1>
        </div>
        <button className="btn btn-primary" onClick={go} disabled={loading} id="run-benchmark-btn">
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Running…</>
            : '▶ Run Benchmark'}
        </button>
      </div>

      {/* Summary stats */}
      {data && (
        <>
          <div className="grid-4 mb-3">
            <StatCard label="Total Keygen" value={data.summary.total_keygen_ms.toFixed(1)} unit="milliseconds" color="var(--cyan)" />
            <StatCard label="Combined PK Size" value={(data.summary.total_public_key_bytes / 1024).toFixed(1)} unit="kilobytes" color="var(--violet)" />
            <StatCard label="Mode" value={data.summary.mode.toUpperCase()} unit="PQC engine" color="var(--green)" />
            <StatCard label="Algorithms" value={data.algorithms.length} unit="families" color="var(--amber)" />
          </div>

          {/* Timing Chart */}
          <div className="card mb-3">
            <p className="section-label mb-2">Operation Timing (ms)</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={keygenData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.07)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }} />
                <Bar dataKey="Keygen (ms)"        fill="var(--cyan)"   radius={[4,4,0,0]} />
                <Bar dataKey="Encap/Sign (ms)"    fill="var(--violet)" radius={[4,4,0,0]} />
                <Bar dataKey="Decap/Verify (ms)"  fill="var(--green)"  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key/Ciphertext sizes */}
          <div className="card mb-3">
            <p className="section-label mb-2">Key & Ciphertext Sizes (bytes)</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sizeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.07)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }} />
                <Bar dataKey="Public Key (B)"         fill="var(--cyan)"   radius={[4,4,0,0]} />
                <Bar dataKey="Private Key (B)"        fill="var(--violet)" radius={[4,4,0,0]} />
                <Bar dataKey="Ciphertext/Sig (B)"     fill="var(--amber)"  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Raw table */}
          <div className="card mb-3">
            <p className="section-label mb-2">Raw Results Table</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Algorithm</th><th>Family</th><th>Keygen (ms)</th>
                    <th>Encap/Sign (ms)</th><th>Decap/Verify (ms)</th>
                    <th>PK Bytes</th><th>SK Bytes</th><th>CT/Sig Bytes</th><th>Δ Mem (KB)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.algorithms.map(a => (
                    <tr key={a.algorithm}>
                      <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{a.algorithm}</td>
                      <td>{a.family}</td>
                      <td className="mono">{a.keygen_ms}</td>
                      <td className="mono">{a.encap_ms ?? a.sign_ms ?? '—'}</td>
                      <td className="mono">{a.decap_ms ?? a.verify_ms ?? '—'}</td>
                      <td className="mono">{a.public_key_bytes.toLocaleString()}</td>
                      <td className="mono">{a.private_key_bytes.toLocaleString()}</td>
                      <td className="mono">{(a.ciphertext_bytes ?? a.signature_bytes ?? 0).toLocaleString()}</td>
                      <td className="mono">{a.memory_delta_kb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Ready to Benchmark</h2>
          <p>Click "Run Benchmark" to measure all three PQC algorithms.</p>
        </div>
      )}

      {/* ── Attack Simulation Panel ── */}
      {data && data.attack_simulation && (
        <div className="card mt-3">
          <div className="flex-between mb-2">
            <p className="section-label">Live Threat Simulation Matrix</p>
            <span className="badge badge-cyan" style={{ fontFamily: 'var(--font-mono)' }}>AST Heuristics Active</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Attack Vector</th>
                  <th>Kyber1024</th>
                  <th>McEliece</th>
                  <th>SPHINCS+</th>
                  <th style={{ color: 'var(--cyan)' }}>Custom Plugin</th>
                </tr>
              </thead>
              <tbody>
                {data.attack_simulation.map((a: any) => (
                  <tr key={a.name}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td><span className={`badge badge-${a.kyber_color}`}>{a.kyber}</span></td>
                    <td><span className={`badge badge-${a.kyber_color}`}>{a.mc}</span></td>
                    <td><span className={`badge badge-${a.kyber_color}`}>{a.sp}</span></td>
                    <td><span className={`badge badge-${a.custom_color}`}>{a.custom}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
