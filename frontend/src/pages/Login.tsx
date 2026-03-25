import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { loginUser } from '../api/client';
import { Lock, User, Eye, EyeOff, ShieldCheck, ServerOff } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) navigate('/chat');
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await loginUser({ username, password });
      login(resp.access_token, resp.user);
      navigate('/chat');
    } catch (err: any) {
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        setError('CRITICAL: Cannot connect to backend server. Please ensure the backend (main.py) is running on port 8000.');
      } else {
        setError(err.response?.data?.detail || 'Authentication failed. Check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', position: 'relative', background: 'var(--background)'
    }}>
      {/* Ambient glow blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '20%', left: '15%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'var(--cyan)', opacity: 0.04, filter: 'blur(120px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '15%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'var(--violet)', opacity: 0.05, filter: 'blur(120px)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }} className="animate-fade-in">
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Top accent bar */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--cyan), var(--violet))' }} />
          
          <div style={{ padding: '2.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 800,
                color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.01em',
              }}>
                AUTHENTICATE_NODE
              </h1>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                Verify your identity to retrieve the session manifest and establish a quantum-safe E2E tunnel.
              </p>
            </div>

            {/* Quick login */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: '0.6rem',
              }}>
                ⚡ Quick Login — Seeded Accounts
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { username: 'Alice',   password: 'password123', color: 'var(--cyan)' },
                  { username: 'Bob',     password: 'password123', color: 'var(--green)' },
                  { username: 'Charlie', password: 'password123', color: 'var(--violet)' },
                ].map(({ username, password, color }) => (
                  <button
                    key={username} type="button"
                    onClick={() => { setUsername(username); setPassword(password); }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600,
                      padding: '0.3rem 0.85rem', borderRadius: '20px', cursor: 'pointer',
                      background: 'transparent', border: `1px solid ${color}55`, color,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {username}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                background: error.includes('CRITICAL') ? 'rgba(255,165,0,0.1)' : 'rgba(255,68,68,0.08)',
                border: `1px solid ${error.includes('CRITICAL') ? 'rgba(255,165,0,0.3)' : 'rgba(255,68,68,0.3)'}`,
                color: error.includes('CRITICAL') ? '#ffb84d' : 'var(--red)',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius)',
                marginBottom: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
              }}>
                {error.includes('CRITICAL') ? <ServerOff size={16} style={{ marginTop: '2px', flexShrink: 0 }} /> : <Lock size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                <span style={{ lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase',
                }}>Alias / Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" autoFocus required value={username} onChange={e => setUsername(e.target.value)}
                    className="input" placeholder="e.g. Alice"
                    style={{ width: '100%', paddingLeft: '2.5rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase',
                }}>Passphrase</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                    className="input" placeholder="••••••••"
                    style={{ width: '100%', paddingLeft: '2.5rem', paddingRight: '2.5rem', fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                    style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn" style={{
                background: 'var(--cyan)', color: '#000', width: '100%',
                marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
              }}>
                {loading ? 'VERIFYING...' : (
                  <> <ShieldCheck size={16} /> VERIFY IDENTITY </>
                )}
              </button>
            </form>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)',
            padding: '1.25rem', textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0
            }}>
              Unregistered node?{' '}
              <Link to="/register" style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>
                Initialize Keypair →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
