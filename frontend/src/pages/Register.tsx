import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { registerUser } from '../api/client';
import { Lock, User, Eye, EyeOff, Zap, Key, Shield, ServerOff } from 'lucide-react';

export const Register: React.FC = () => {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await registerUser({ username, password });
      login(resp.access_token, resp.user);
      navigate('/chat');
    } catch (err: any) {
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        setError('CRITICAL: Cannot connect to backend server. Please ensure the backend (main.py) is running on port 8000.');
      } else {
        setError(err.response?.data?.detail || 'Registration failed. Try a different alias.');
      }
    } finally {
      setLoading(false);
    }
  };

  const keyGenItems = [
    { icon: Key,    label: 'Kyber1024',  sub: 'KEM keypair',  color: 'var(--cyan)' },
    { icon: Zap,    label: 'AES-GCM',    sub: 'Session sym',  color: 'var(--green)' },
    { icon: Shield, label: 'SPHINCS+',   sub: 'Sig keypair',  color: 'var(--violet)' },
  ];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', position: 'relative', background: 'var(--background)'
    }}>
      {/* Ambient glow blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '15%', right: '15%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'var(--green)', opacity: 0.04, filter: 'blur(120px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '15%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'var(--cyan)', opacity: 0.04, filter: 'blur(120px)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }} className="animate-fade-in">
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Top accent bar */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--green), var(--cyan))' }} />
          
          <div style={{ padding: '2.5rem' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 800,
                color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.01em',
              }}>
                INITIALIZE_NODE
              </h1>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                Deploy a new entity onto the quantum-safe network. This will generate your asymmetric cryptographic suite.
              </p>
            </div>

            {/* Visual indicators of what's being generated */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem'
            }}>
              {keyGenItems.map(({ icon: Icon, label, sub, color }, idx) => (
                <div key={idx} style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${color}33`,
                  borderRadius: 'var(--radius)',
                  padding: '0.85rem 0.5rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.4rem'
                }}>
                  <Icon size={16} style={{ color }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-muted)' }}>{sub}</span>
                  </div>
                </div>
              ))}
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
                {error.includes('CRITICAL') ? <ServerOff size={16} style={{ marginTop: '2px', flexShrink: 0 }} /> : <Shield size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                <span style={{ lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase',
                }}>Node Alias / Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" autoFocus required minLength={3} value={username} onChange={e => setUsername(e.target.value)}
                    className="input" placeholder="e.g. Charlie"
                    style={{ width: '100%', paddingLeft: '2.5rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase',
                }}>Master Passphrase</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showPass ? 'text' : 'password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
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
                background: 'var(--green)', color: '#000', width: '100%',
                marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
              }}>
                {loading ? 'GENERATING KEYPAIRS...' : (
                  <> <Zap size={16} /> DEPLOY SECURE NODE </>
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
              Node already exists?{' '}
              <Link to="/login" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>
                Authenticate Here →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
