import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Dosare       from './pages/Dosare';
import DosarNou     from './pages/DosarNou';
import DosarDetaliu from './pages/DosarDetaliu';
import Calendar     from './pages/Calendar';
import Profil       from './pages/Profil';

function ProtectedRoute({ children, roluriPermise }) {
  const { utilizator, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#16244a' }}>
      <p style={{ color: 'white' }}>Se încarcă...</p>
    </div>
  );

  if (!utilizator) return <Navigate to="/login" replace />;
  if (roluriPermise && !roluriPermise.includes(utilizator.rol))
    return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Pagini publice — fără nicio restricție */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Pagini protejate */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dosare"    element={<ProtectedRoute><Dosare /></ProtectedRoute>} />
      <Route path="/profil"    element={<ProtectedRoute><Profil /></ProtectedRoute>} />

      {/* IMPORTANT: /dosar/nou înaintea /dosar/:id */}
      <Route path="/dosar/nou" element={
        <ProtectedRoute roluriPermise={['cetățean']}><DosarNou /></ProtectedRoute>
      } />
      <Route path="/dosar/:id" element={
        <ProtectedRoute><DosarDetaliu /></ProtectedRoute>
      } />
      <Route path="/calendar" element={
      <ProtectedRoute roluriPermise={['funcționar', 'manager', 'administrator']}>
      <Calendar />
      </ProtectedRoute>
      } />
      <Route path="/programari" element={
      <ProtectedRoute roluriPermise={['cetățean']}>
      <Calendar />
      </ProtectedRoute>
      } />

      <Route path="/"  element={<Navigate to="/login" replace />} />
      <Route path="*"  element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={4000} newestOnTop theme="light" />
      </BrowserRouter>
    </AuthProvider>
  );
}