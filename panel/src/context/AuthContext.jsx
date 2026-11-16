import { createContext, useContext, useEffect, useState } from 'react';
import { api, onLoginRequired } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// status: loading (first check), out (login page), in (panel), blocked (email OTP ran out)
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading');
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let alive = true;
    api.me()
      .then((data) => {
        if (!alive) return;
        setAdmin(data.admin);
        setStatus('in');
      })
      .catch((err) => {
        if (alive) setStatus(err.code === 'access_expired' ? 'blocked' : 'out');
      });
    const stop = onLoginRequired(() => {
      setAdmin(null);
      setStatus('out');
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setAdmin(data.admin);
    setStatus('in');
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setAdmin(null);
      setStatus('out');
    }
  };

  return (
    <AuthContext.Provider value={{ status, admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
