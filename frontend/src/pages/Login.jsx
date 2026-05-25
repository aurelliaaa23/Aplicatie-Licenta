import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STEPS = ['Date de autentificare', 'Verificare cod'];

export default function Login() {
  const { login, utilizator } = useAuth();
  const navigate = useNavigate();

  // ── TOȚI hooks declarați ÎNAINTE de orice return condiționat ──
  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [erori, setErori]         = useState({});
  const [form, setForm]           = useState({ email: '', parola: '' });
  const [cod, setCod]             = useState('');
  const [userId, setUserId]       = useState(null);
  const [emailMascat, setEmailMascat] = useState('');
  const [countdown, setCountdown] = useState(0);

  // ── Acum e safe să facem early return ──
  if (utilizator) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErori((er) => ({ ...er, [k]: '' }));
  };

  const startCountdown = () => {
    setCountdown(60);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(iv); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // Pasul 1: trimite credențialele → primești OTP pe email
  const handleLogin = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.email) err.email = 'Email obligatoriu';
    else if (!/\S+@\S+\.\S+/.test(form.email)) err.email = 'Email invalid';
    if (!form.parola) err.parola = 'Parola obligatorie';
    if (Object.keys(err).length) { setErori(err); return; }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setUserId(data.user_id);
      setEmailMascat(data.email_mascat);
      setStep(1);
      startCountdown();
      toast.info(`Cod trimis pe ${data.email_mascat}`);
    } catch (err) {
      const msg = err.response?.data?.eroare || 'Eroare la autentificare';
      if (err.response?.data?.neverificat) {
        toast.warning('Contul nu este verificat. Verificați email-ul.');
        navigate('/register?verifica=' + err.response.data.user_id);
        return;
      }
      setErori({ general: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Pasul 2: verifică OTP → primești JWT
  const handleVerifica = async (e) => {
    e.preventDefault();
    if (!cod || cod.length !== 6) {
      setErori({ cod: 'Introduceți codul de 6 cifre' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verifica-otp-login', { user_id: userId, cod });
      login(data.token, data.utilizator);
      toast.success(`Bun venit, ${data.utilizator.prenume}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.eroare || 'Cod incorect';
      setErori({ cod: msg });
      if (msg.includes('expirat')) setStep(0);
    } finally {
      setLoading(false);
    }
  };

  // Retrimite codul
  const retrimite = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await api.post('/auth/retrimite-otp', { user_id: userId });
      toast.info('Cod nou trimis pe email');
      startCountdown();
      setCod('');
      setErori({});
    } catch {
      toast.error('Nu s-a putut retrimite codul');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-left">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <div className="logo-row">
              <div className="logo-box">DG</div>
              <h2>DGASPC Digital</h2>
            </div>
            <p>Direcția Generală de Asistență Socială și Protecția Copilului</p>
          </div>

          {/* Stepper */}
          <div className="stepper" style={{ marginBottom: 24 }}>
            {STEPS.map((label, i) => (
              <div key={i} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                <div className="step-circle">{i < step ? '✓' : i + 1}</div>
                <div className="step-label">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Pasul 0: credențiale ── */}
          {step === 0 && (
            <>
              <h3>Autentificare</h3>
              <p className="subtitle">Introduceți credențialele contului dvs.</p>

              <form onSubmit={handleLogin} noValidate>
                <div className="form-group">
                  <label>Adresă email</label>
                  <input type="email"
                    className={`form-input${erori.email ? ' error' : ''}`}
                    placeholder="exemplu@email.ro"
                    value={form.email} onChange={set('email')}
                    autoComplete="email" autoFocus />
                  {erori.email && <p className="form-error">{erori.email}</p>}
                </div>

                <div className="form-group">
                  <label>Parolă</label>
                  <input type="password"
                    className={`form-input${erori.parola ? ' error' : ''}`}
                    placeholder="••••••••"
                    value={form.parola} onChange={set('parola')}
                    autoComplete="current-password" />
                  {erori.parola && <p className="form-error">{erori.parola}</p>}
                </div>

                {erori.general && (
                  <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                    marginBottom: 14, fontSize: 13, color: 'var(--danger)' }}>
                    {erori.general}
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading
                    ? <><div className="loading-spinner" /> Se verifică...</>
                    : 'Continuare →'}
                </button>
              </form>
            </>
          )}

          {/* ── Pasul 1: cod OTP ── */}
          {step === 1 && (
            <>
              <h3>Verificare cod</h3>
              <p className="subtitle">
                Am trimis un cod de 6 cifre pe{' '}
                <strong style={{ color: 'var(--blue)' }}>{emailMascat}</strong>
              </p>

              <div style={{ background: 'var(--info-bg)', border: '1px solid #bae6fd',
                borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>📧</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--info)', margin: 0 }}>
                    Verificați inbox-ul
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
                    Codul este valabil 10 minute. Verificați și folderul Spam.
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifica} noValidate>
                <div className="form-group">
                  <label>Codul primit pe email</label>
                  <input
                    type="text"
                    className={`form-input${erori.cod ? ' error' : ''}`}
                    placeholder="000000"
                    maxLength={6}
                    value={cod}
                    onChange={(e) => {
                      setCod(e.target.value.replace(/\D/g, ''));
                      setErori((er) => ({ ...er, cod: '' }));
                    }}
                    autoFocus
                    inputMode="numeric"
                    style={{ textAlign: 'center', fontSize: 28, letterSpacing: 12,
                      fontFamily: 'DM Mono, monospace', fontWeight: 700 }}
                  />
                  {erori.cod && <p className="form-error">{erori.cod}</p>}
                </div>

                <button type="submit" className="btn btn-primary btn-full"
                  disabled={loading || cod.length !== 6}>
                  {loading
                    ? <><div className="loading-spinner" /> Se verifică...</>
                    : '✓ Verificare și autentificare'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                {countdown > 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Puteți cere un cod nou în <strong>{countdown}s</strong>
                  </p>
                ) : (
                  <button onClick={retrimite} disabled={resending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--blue)', fontSize: 13, fontFamily: 'inherit' }}>
                    {resending ? '⏳ Se trimite...' : '🔄 Nu ați primit codul? Retrimiteți'}
                  </button>
                )}
              </div>

              <button onClick={() => { setStep(0); setCod(''); setErori({}); }}
                className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>
                ← Înapoi
              </button>
            </>
          )}

          <hr className="divider" />
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
            Nu aveți cont?{' '}
            <Link to="/register" className="text-link" style={{ fontWeight: 500 }}>
              Înregistrați-vă
            </Link>
          </p>
        </div>
      </div>

      {/* Panoul din dreapta */}
      <div className="auth-right">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ margin: '0 auto' }}>
              <circle cx="60" cy="60" r="56" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.3)" strokeWidth="1"/>
              <rect x="32" y="36" width="56" height="48" rx="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
              <rect x="40" y="44" width="40" height="4" rx="2" fill="rgba(255,255,255,0.4)"/>
              <rect x="40" y="52" width="28" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>
              <rect x="40" y="60" width="34" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>
              <rect x="40" y="68" width="22" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>
              <circle cx="80" cy="76" r="14" fill="rgba(37,99,235,0.8)"/>
              <path d="M74 76l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Platformă digitală DGASPC
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            Gestionați dosarele sociale, documentele și programările la comisii
            într-un singur loc sigur și eficient.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['📧', 'Autentificare prin cod pe email'],
              ['📋', 'Management complet al dosarelor'],
              ['✍️', 'Semnătură electronică integrată'],
              ['🔔', 'Notificări în timp real'],
            ].map(([emoji, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.07)', borderRadius: 8,
                padding: '10px 14px', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}