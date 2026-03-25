import React, { createContext, useContext, useState, useEffect } from 'react';
import { DbUser } from './api/client';

interface AuthContextType {
  user: DbUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: DbUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<DbUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      // Decode JWT expiry without a library (base64url middle segment)
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
          // Token already expired on load — clear it immediately
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          // Schedule auto-logout at exact expiry time if exp is set
          if (payload.exp) {
            const msUntilExpiry = payload.exp * 1000 - Date.now();
            setTimeout(() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('user');
              setToken(null);
              setUser(null);
            }, msUntilExpiry);
          }
        }
      } catch {
        // Malformed token — discard
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: DbUser) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
