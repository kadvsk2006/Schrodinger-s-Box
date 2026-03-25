import React, { useState } from 'react';
import { ShieldAlert, Upload, Cpu, ShieldCheck, Activity, Terminal, AlertTriangle, RotateCcw } from 'lucide-react';
import { analyzeAlgorithm } from '../api/client';

type VulnStatus = 'FATAL' | 'VULNERABLE' | 'QUANTUM-RESISTANT' | 'PENDING' | 'CRITICAL';

function StatusBadge({ status }: { status: VulnStatus }) {
  const cfg: Record<VulnStatus, { color: string; label: string; Icon: any }> = {
    FATAL:              { color: 'red',    label: 'FATAL VULNERABILITY',  Icon: ShieldAlert },
    VULNERABLE:         { color: 'orange', label: 'VULNERABLE',           Icon: AlertTriangle },
    'QUANTUM-RESISTANT':{ color: 'green',  label: 'QUANTUM-RESISTANT',    Icon: ShieldCheck },
    PENDING:            { color: 'yellow', label: 'ANALYZING…',           Icon: Activity },
    CRITICAL:           { color: 'red',    label: 'CRITICAL',             Icon: ShieldAlert },
  };
  const { color, label, Icon } = cfg[status] ?? cfg['PENDING'];
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-sm border
      bg-${color}-500/10 text-${color}-400 border-${color}-500/30`}>
      <Icon className="w-4 h-4" /> {label}
    </span>
  );
}

function SecurityGauge({ status }: { status: VulnStatus }) {
  const score = status === 'QUANTUM-RESISTANT' ? 96 : status === 'VULNERABLE' ? 42 : status === 'PENDING' ? 65 : 8;
  const color = status === 'QUANTUM-RESISTANT' ? 'var(--green)' : status === 'VULNERABLE' ? 'var(--amber)' : 'var(--red)';
  const R = 54;
  const circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={R} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: '1.2s cubic-bezier(.4,0,.2,1)' }}
        />
        <text x="65" y="58" textAnchor="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="Inter">{score}</text>
        <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="Inter">/ 100</text>
      </svg>
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Security Score</p>
    </div>
  );
}

export default function AlgorithmAnalyzer({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setReport(null);
      setError(null);
    }
  };

  const reset = () => { setFile(null); setReport(null); setError(null); };

  const runAnalysis = async () => {
    if (!file) return;
    setIsClassifying(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await analyzeAlgorithm(formData);
      if (res.success) setReport(res.report);
      else setError('Analysis failed. Server rejected the file.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to classify algorithm.');
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <div className={`animate-fade-in ${isEmbedded ? 'p-8' : 'max-w-5xl mx-auto px-6 py-12'}`}>

      {/* Standalone header */}
      {!isEmbedded && (
        <header className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-full border border-red-500/20 mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span className="font-mono text-xs tracking-widest uppercase">Algorithm Threat Scanner</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight">Dynamic <span className="text-red-500">Vulnerability</span> Analyzer</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            Upload any encryption script. The quantum heuristic engine parses the logic, extracts key sizes, and calculates exactly how long a quantum computer needs to break it.
          </p>
        </header>
      )}

      {/* Upload Zone */}
      {!file && !report && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: '100%', minHeight: '220px',
          border: '2px dashed rgba(239,68,68,0.25)', borderRadius: '16px',
          cursor: 'pointer', background: 'rgba(239,68,68,0.04)',
          transition: 'all 0.3s ease', padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'
          }}>
            <Upload style={{ width: 26, height: 26, color: '#f87171' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.25rem' }}>
            Click to upload or drag &amp; drop
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Python, JS, C++, any source file</p>
          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
      )}

      {/* File ready state */}
      {file && !report && !isClassifying && (
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-5 w-full max-w-md">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono font-semibold text-gray-200 truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB · Ready for Quantum Deep-Scan</p>
            </div>
            <button onClick={reset} className="text-muted-foreground hover:text-red-400 transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <button onClick={runAnalysis} className="btn btn-primary px-10 py-3 text-base font-mono font-bold rounded-xl">
            ⚡ Scan Algorithm Integrity
          </button>
        </div>
      )}

      {/* Loading */}
      {isClassifying && (
        <div className="flex flex-col items-center gap-6 py-16">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
            <div className="w-24 h-24 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin relative z-10" />
            <Activity className="w-8 h-8 text-red-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-mono text-red-400 font-bold animate-pulse">Running Shor & Grover Projections...</p>
            <p className="text-xs text-muted-foreground font-mono">Parsing code tokens and mathematical structures.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <button onClick={reset} className="text-xs text-muted-foreground hover:text-white underline ml-4 shrink-0">Try Again</button>
        </div>
      )}

      {/* ── THREAT REPORT ── */}
      {report && (
        <div className="mt-4 animate-fade-in">
          {/* Top accent bar */}
          <div className={`h-1 w-full rounded-t-xl ${
            report.vulnerability_status === 'QUANTUM-RESISTANT'
              ? 'bg-gradient-to-r from-green-500 to-accent'
              : report.vulnerability_status === 'VULNERABLE'
              ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
              : 'bg-gradient-to-r from-red-600 to-pink-600'
          }`} />

          <div className="bg-black/30 border border-white/10 rounded-b-2xl overflow-hidden">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-white/5">
              <div>
                <h3 className="text-xl font-bold text-white font-mono uppercase tracking-wider">Threat Report</h3>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">Target: {file?.name}</p>
              </div>
              <StatusBadge status={report.vulnerability_status} />
            </div>

            {/* Main 3-column grid */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Col 1: Gauge */}
              <div className="flex items-center justify-center bg-white/3 rounded-xl border border-white/5 p-6">
                <SecurityGauge status={report.vulnerability_status} />
              </div>

              {/* Col 2: Details */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest">Algorithm Detected</p>
                  <p className="font-mono text-sm text-gray-100 bg-white/5 border border-white/8 rounded-lg px-3 py-2">{report.algorithm_detected}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest">Quantum Attack Vector</p>
                  <p className="font-mono text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 shrink-0" /> {report.quantum_attack}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest">Logical Qubits Required</p>
                  <p className="font-mono text-lg font-bold text-accent flex items-center gap-2">
                    <Cpu className="w-5 h-5" /> {report.qubits_required}
                  </p>
                </div>
              </div>

              {/* Col 3: Crack time */}
              <div className="flex flex-col items-center justify-center bg-red-500/5 border border-red-500/15 rounded-xl p-6 text-center gap-3">
                <p className="text-[0.65rem] font-mono text-red-400 uppercase tracking-widest">Estimated Crack Time</p>
                <p className="text-3xl font-bold text-red-400 font-mono leading-tight">{report.time_to_crack}</p>
                <p className="text-[0.6rem] text-muted-foreground font-mono opacity-60 leading-tight">
                  assuming a fault-tolerant QPU<br/>at 10MHz gate clock
                </p>
              </div>
            </div>

            {/* Analysis narrative */}
            <div className="mx-6 mb-6 bg-white/3 border border-white/8 rounded-xl p-5 space-y-2">
              <p className="text-[0.65rem] font-mono text-accent uppercase tracking-widest">Quantum Engine Analysis</p>
              <p className="text-sm font-mono text-gray-300 leading-relaxed border-l-2 border-accent pl-4">{report.details}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-black/20">
              <span className="text-[0.65rem] font-mono text-muted-foreground">Schrödinger's Box · Quantum Cryptanalysis v2.4.1</span>
              <button onClick={reset} className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Scan Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
