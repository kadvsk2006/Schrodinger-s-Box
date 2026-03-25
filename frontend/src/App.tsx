import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom'
import Landing from './pages/Landing'
import Messenger from './pages/Messenger'
import ThreatIntelligence from './pages/ThreatIntelligence'
import Benchmark from './pages/Benchmark'
import CustomAlgorithm from './pages/CustomAlgorithm'
import SecureChat from './pages/SecureChat'
import EncryptionLayers from './pages/EncryptionLayers'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { AuthProvider, useAuth } from './AuthContext'
import { Hexagon, Lock, Activity, BarChart2, GitPullRequest, Shield, Layers } from 'lucide-react'
import { useCyberEffects } from './hooks/useCyberEffects'

/** Activates all global cyber interactions inside the router/auth tree */
function CyberRoot({ children }: { children: React.ReactNode }) {
  useCyberEffects()
  return <>{children}</>
}

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(2, 8, 23, 0.88)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(0,229,255,0.1)',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      gap: '1rem',
    }}>

      {/* Brand — left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
        <Hexagon style={{ width: 22, height: 22, color: 'var(--cyan)' }} />
        <span style={{
          fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Schrödinger's <span style={{ color: 'var(--cyan)', WebkitTextFillColor: 'var(--cyan)' }}>Box</span>
        </span>
      </div>

      {/* Nav links — center */}
      <ul style={{
        display: 'flex', alignItems: 'center', gap: '0.25rem',
        listStyle: 'none', margin: 0, padding: 0,
      }}>
        {[
          { to: '/',          label: 'Home',               icon: null },
          { to: '/chat',      label: 'Secure Network',     icon: <Lock size={14}/> },
          { to: '/advanced',  label: 'Advanced Tunnel',    icon: <Shield size={14}/> },
          { to: '/threat',    label: 'Threat Intelligence',icon: <Activity size={14}/> },
          { to: '/benchmark', label: 'Benchmarks',         icon: <BarChart2 size={14}/> },
          { to: '/layers',    label: 'Layer X-Ray',         icon: <Layers size={14}/> },
          { to: '/custom',    label: 'BYOA Plugin',        icon: <GitPullRequest size={14}/> },
        ].map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
                background: isActive ? 'rgba(0,229,255,0.07)' : 'transparent',
                transition: 'color 0.2s, background 0.2s',
                whiteSpace: 'nowrap',
              })}
            >
              {icon}{label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Auth — right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        {user ? (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--green)' }}>
              [{user.username}]
            </span>
            <button
              onClick={logout}
              style={{
                background: 'none', border: '1px solid rgba(255,68,68,0.35)',
                color: 'var(--red)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600,
                padding: '0.28rem 0.75rem', borderRadius: '6px', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              DISCONNECT
            </button>
          </>
        ) : (
          <>
            <NavLink
              to="/login"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              LOGIN
            </NavLink>
            <NavLink
              to="/register"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em',
                background: 'linear-gradient(135deg, var(--cyan-dim), var(--violet-dim))',
                color: '#fff', padding: '0.38rem 1rem', borderRadius: '20px',
                boxShadow: '0 0 14px rgba(0,180,255,0.3)', transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              DEPLOY_NODE
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}

const PrivateRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background font-mono text-[var(--cyber-blue)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--cyber-blue)] border-t-transparent rounded-full animate-spin" />
          <span>SYNCHRONIZING_QUANTUM_SESSION...</span>
        </div>
      </div>
    );
  }
  
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      {/* ── Floating Cryptography-Themed Particles ───────────── */}
      <div className="crypto-particles">
        {/* Hexagons — Kyber key exchange — slow parallax */}
        <div className="crypto-parallax-slow">
          <div className="crypto-hex crypto-hex-1" />
          <div className="crypto-hex crypto-hex-2" />
          <div className="crypto-hex crypto-hex-3" />
          <div className="crypto-lattice crypto-lattice-1" />
          <div className="crypto-lattice crypto-lattice-2" />
        </div>

        {/* Mid-speed parallax */}
        <div className="crypto-parallax-mid">
          <div className="crypto-lock crypto-lock-1" />
          <div className="crypto-lock crypto-lock-2" />
          <div className="crypto-shield crypto-shield-1" />
          <div className="crypto-shield crypto-shield-2" />
          <div className="crypto-key crypto-key-1" />
          <div className="crypto-key crypto-key-2" />
        </div>

        {/* Fast parallax — qubits, binary, hash */}
        <div className="crypto-parallax-fast">
          <div className="crypto-qubit crypto-qubit-1" />
          <div className="crypto-qubit crypto-qubit-2" />
          <div className="crypto-binary crypto-binary-1" />
          <div className="crypto-binary crypto-binary-2" />
          <div className="crypto-binary crypto-binary-3" />
          <div className="crypto-hash crypto-hash-1">
            <span /><span /><span /><span /><span /><span /><span /><span /><span />
          </div>
          <div className="crypto-hash crypto-hash-2">
            <span /><span /><span /><span /><span /><span /><span /><span /><span />
          </div>
        </div>
      </div>

      <BrowserRouter>
        <CyberRoot>
          <Navbar />
          <Routes>
            <Route path="/"          element={<Landing />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/threat"    element={<ThreatIntelligence />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/custom"    element={<CustomAlgorithm />} />
            <Route path="/advanced"  element={<SecureChat />} />
            <Route path="/layers"    element={<EncryptionLayers />} />

            <Route element={<PrivateRoute />}>
              <Route path="/chat"    element={<Messenger />} />
            </Route>
          </Routes>
        </CyberRoot>
      </BrowserRouter>
    </AuthProvider>
  )
}
