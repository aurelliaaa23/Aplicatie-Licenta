import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STEPS = ['Date personale', 'Cont & parolă', 'Verificare cod'];

const DEPARTAMENTE = [
  'Evaluare Adulți (SECPAH)',
  'Protecția Copilului',
  'Adopții',
  'Asistență Socială',
  'Relații cu Publicul'
];

const SPECIALITATI = [
  'Medicină de familie',
  'Cardiologie', 'Neurologie', 'Ortopedie', 'Psihiatrie', 
  'Oftalmologie', 'ORL', 'Oncologie', 'Medicină Internă', 
  'Chirurgie', 'Pneumologie', 'Diabet și Nutriție'
];

export default function Register() {
  const { utilizator } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [erori, setErori]       = useState({});
  const [userId, setUserId]     = useState(null);

  const [codEmail, setCodEmail]   = useState('');
  const [countdown, setCountdown] = useState(0);

  // Tip cont (nou)
  const [tipCont, setTipCont] = useState('cetățean'); // 'cetățean', 'funcționar', 'medic'

  const [form, setForm] = useState({
    prenume: '', nume: '', cnp: '', telefon: '',
    email: '', parola: '', confirmare: '',
    departament: '', specialitate: '', judet: '', oras: ''
  });

  if (utilizator) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErori((er) => ({ ...er, [k]: '' }));
  };

  const startCountdown = () => {
    setCountdown(60);
    const iv = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
  };

  const validateStep0 = () => {
    const e = {};
    if (!form.prenume.trim()) e.prenume = 'Prenumele este obligatoriu';
    if (!form.nume.trim())    e.nume    = 'Numele este obligatoriu';
    if (!form.telefon) e.telefon = 'Telefonul este obligatoriu';
    
    // Validări specifice tipului de cont
    if (tipCont === 'cetățean') {
      if (!form.cnp || form.cnp.length !== 13 || !/^\d{13}$/.test(form.cnp)) {
        e.cnp = 'CNP invalid — trebuie să aibă exact 13 cifre';
      }
    }
    if (tipCont === 'funcționar' && !form.departament) {
      e.departament = 'Selectați un departament';
    }
    if (tipCont === 'medic') {
      if (!form.specialitate) e.specialitate = 'Selectați specialitatea';
      if (!form.judet.trim()) e.judet = 'Introduceți județul de practică';
    }

    setErori(e);
    return !Object.keys(e).length;
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email invalid';
    if (!form.parola || form.parola.length < 8) e.parola = 'Parola trebuie să aibă minim 8 caractere';
    if (form.parola !== form.confirmare) e.confirmare = 'Parolele nu coincid';
    setErori(e);
    return !Object.keys(e).length;
  };

  const nextStep = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1) { handleRegister(); return; }
    setStep((s) => s + 1);
  };

  // ── Creare cont și trimitere E-mail ──
  const handleRegister = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    
    try {
      const { data } = await api.post('/auth/register', {
        prenume: form.prenume, nume: form.nume,
        email: form.email,     parola: form.parola,
        telefon: form.telefon, 
        cnp: form.cnp,         tipCont: tipCont,
        departament: form.departament,
        specialitate: form.specialitate,
        judet: form.judet,     oras: form.oras
      });

      setUserId(data.user_id); 
      setStep(2);
      startCountdown();
      toast.success('Codul de verificare a fost trimis pe E-mail!');
      
    } catch (err) {
      console.error("Eroare la înregistrare:", err);
      const msg = err.response?.data?.eroare || err.message || 'Eroare la înregistrare';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Verificare cod E-mail ──
  const handleVerifica = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post('/auth/verifica-cont', { 
        user_id: userId, 
        cod_email: codEmail 
      });

      toast.success('Cont activat cu succes! Vă puteți autentifica.');
      navigate('/login');
      
    } catch (err) {
      console.error("Eroare verificare:", err);
      const msg = err.response?.data?.eroare || 'Codul este incorect sau a expirat.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  
  const retrimite = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await api.post('/auth/retrimite-otp', { user_id: userId });
      toast.info('Cod nou trimis pe email');
      startCountdown();
      setCodEmail('');
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
        <div className="auth-card" style={{ maxWidth: 460, padding: '36px 40px' }}>
          
          <div className="auth-logo">
            <div className="logo-row">
              <div className="logo-box">DG</div>
              <h2>DGASPC Digital</h2>
            </div>
            <p>Creați un cont nou pe platforma DGASPC</p>
          </div>

          <div className="stepper" style={{ marginBottom: 28 }}>
            {STEPS.map((label, i) => (
              <div key={i} className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                <div className="step-circle">{i < step ? '✓' : i + 1}</div>
                <div className="step-label">{label}</div>
              </div>
            ))}
          </div>

          {step === 0 && (
            <>
              {/* TABURI TIP CONT NOU (integrate cu designul) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface)', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
                {['cetățean', 'funcționar', 'medic'].map(tip => (
                  <button 
                    key={tip} type="button" 
                    onClick={() => { setTipCont(tip); setForm({...form, cnp: '', departament: '', specialitate: '', judet: '', oras: ''}); setErori({}); }}
                    style={{ 
                      flex: 1, padding: '8px 0', border: 'none', borderRadius: 4, 
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', transition: '0.2s',
                      background: tipCont === tip ? 'var(--blue)' : 'transparent',
                      color: tipCont === tip ? 'white' : 'var(--text-2)',
                    }}
                  >
                    {tip}
                  </button>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Prenume *</label>
                  <input type="text" className={`form-input${erori.prenume ? ' error' : ''}`}
                    placeholder="Ion" value={form.prenume} onChange={set('prenume')} autoFocus />
                  {erori.prenume && <p className="form-error">{erori.prenume}</p>}
                </div>
                <div className="form-group">
                  <label>Nume *</label>
                  <input type="text" className={`form-input${erori.nume ? ' error' : ''}`}
                    placeholder="Popescu" value={form.nume} onChange={set('nume')} />
                  {erori.nume && <p className="form-error">{erori.nume}</p>}
                </div>
              </div>

              {/* DATE SPECIFICE ÎN FUNCȚIE DE CONT */}
              {tipCont === 'cetățean' && (
                <div className="form-group">
                  <label>CNP *</label>
                  <input type="text" className={`form-input${erori.cnp ? ' error' : ''}`}
                    placeholder="1234567890123" maxLength={13}
                    value={form.cnp} onChange={set('cnp')}
                    style={{ fontFamily: 'DM Mono, monospace', letterSpacing: 3 }} />
                  {erori.cnp && <p className="form-error">{erori.cnp}</p>}
                </div>
              )}

              {tipCont === 'funcționar' && (
                <div className="form-group">
                  <label>Departament *</label>
                  <select className={`form-input${erori.departament ? ' error' : ''}`} value={form.departament} onChange={set('departament')}>
                    <option value="">Alege departamentul...</option>
                    {DEPARTAMENTE.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {erori.departament && <p className="form-error">{erori.departament}</p>}
                </div>
              )}

              {tipCont === 'medic' && (
                <>
                  <div className="form-group">
                    <label>Specialitate Medicală *</label>
                    <select className={`form-input${erori.specialitate ? ' error' : ''}`} value={form.specialitate} onChange={set('specialitate')}>
                      <option value="">Alege specialitatea...</option>
                      {SPECIALITATI.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {erori.specialitate && <p className="form-error">{erori.specialitate}</p>}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Județ practică *</label>
                      <input type="text" className={`form-input${erori.judet ? ' error' : ''}`} placeholder="ex: București" value={form.judet} onChange={set('judet')} />
                      {erori.judet && <p className="form-error">{erori.judet}</p>}
                    </div>
                    <div className="form-group">
                      <label>Oraș practică (Opțional)</label>
                      <input type="text" className="form-input" value={form.oras} onChange={set('oras')} />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Număr de telefon *</label>
                <input type="tel" className={`form-input${erori.telefon ? ' error' : ''}`}
                  placeholder="07xx xxx xxx" value={form.telefon} onChange={set('telefon')} />
                {erori.telefon && <p className="form-error">{erori.telefon}</p>}
              </div>

              <button className="btn btn-primary btn-full" onClick={nextStep}>
                Continuare →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="form-group">
                <label>Adresă email *</label>
                <input type="email" className={`form-input${erori.email ? ' error' : ''}`}
                  placeholder="email@exemplu.ro" value={form.email} onChange={set('email')} autoFocus />
                {erori.email && <p className="form-error">{erori.email}</p>}
                <p className="form-hint">
                  📧 Veți primi un cod de verificare pe această adresă.
                </p>
              </div>

              <div className="form-group">
                <label>Parolă *</label>
                <input type="password" className={`form-input${erori.parola ? ' error' : ''}`}
                  placeholder="Minim 8 caractere" value={form.parola} onChange={set('parola')} />
                {erori.parola && <p className="form-error">{erori.parola}</p>}
                {form.parola && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {[
                      [form.parola.length >= 8,          '≥8 caractere'],
                      [/[A-Z]/.test(form.parola),        'Literă mare'],
                      [/\d/.test(form.parola),           'Cifră'],
                      [/[^A-Za-z0-9]/.test(form.parola), 'Caracter special'],
                    ].map(([ok, label]) => (
                      <span key={label} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: ok ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {ok ? '✓' : '✗'} {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Confirmare parolă *</label>
                <input type="password" className={`form-input${erori.confirmare ? ' error' : ''}`}
                  placeholder="Repetați parola" value={form.confirmare} onChange={set('confirmare')} />
                {erori.confirmare && <p className="form-error">{erori.confirmare}</p>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setStep(0)} style={{ flex: 1 }}>
                  ← Înapoi
                </button>
                <button className="btn btn-primary" style={{ flex: 2 }}
                  onClick={nextStep} disabled={loading}>
                  {loading
                    ? <><div className="loading-spinner" /> Se trimite codul...</>
                    : 'Creează contul →'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                  Verificare identitate
                </h3>
                <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Pentru siguranța contului, am trimis un cod de verificare pe adresa dumneavoastră de <strong>E-mail</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifica} noValidate>
                <div className="form-group">
                  <label>📧 Cod E-mail</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="000000"
                    maxLength={6}
                    value={codEmail}
                    onChange={(e) => setCodEmail(e.target.value.replace(/\D/g, ''))}
                    style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8,
                      fontFamily: 'DM Mono, monospace', fontWeight: 700 }}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '24px' }}
                  disabled={loading || codEmail.length !== 6}>
                  {loading
                    ? <><div className="loading-spinner" /> Se verifică...</>
                    : '✓ Validează codul'}
                </button>
              </form>
          
              <div style={{ textAlign: 'center', marginTop: 14 }}>
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
            </>
          )}

          {step < 2 && (
            <>
              <hr className="divider" />
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)' }}>
                Aveți deja cont?{' '}
                <Link to="/login" className="text-link" style={{ fontWeight: 500 }}>
                  Autentificați-vă
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="auth-right">
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 360, textAlign: 'center' }}>
          <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Acces rapid la servicii sociale
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>
            Înregistrarea durează mai puțin de 2 minute. Veți putea depune dosare,
            urmări statusul acestora și comunica cu funcționarii DGASPC.
          </p>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['📧', 'Verificare identitate prin email'],
              ['📋', 'Depunere online dosare sociale'],
              ['🔔', 'Notificări instant la orice schimbare'],
            ].map(([emoji, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.06)', borderRadius: 8,
                padding: '10px 14px', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}