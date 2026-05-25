import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [utilizator, setUtilizator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dgaspc_token');
    if (token) {
      api.get('/auth/profil')
        .then(({ data }) => setUtilizator(data.utilizator))
        .catch(() => localStorage.removeItem('dgaspc_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('dgaspc_token', token);
    setUtilizator(userData);
  };

  const logout = () => {
    localStorage.removeItem('dgaspc_token');
    setUtilizator(null);
  };

  const updateUtilizator = (data) => setUtilizator((prev) => ({ ...prev, ...data }));

  return (
    <AuthContext.Provider value={{ utilizator, loading, login, logout, updateUtilizator }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);