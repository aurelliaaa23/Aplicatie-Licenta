import { useState } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Profil() {
  const { utilizator, updateUtilizator } = useAuth();
  const [loading, setLoading]  = useState(false);
  const [tabActiv, setTabActiv] = useState('profil');

  const [form, setForm] = useState({
    prenume:  utilizator?.prenume  || '',
    nume:     utilizator?.nume     || '',
    telefon:  utilizator?.telefon  || '',
    email:    utilizator?.email    || '',
  });

  const [parole, setParole] = useState({
    parola_curenta: '', parola_noua: '', confirmare: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k) => (e) => setParole((p) => ({ ...p, [k]: e.target.value }));

  const salveazaProfil = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/profil', form);
      updateUtilizator(data.utilizator || form);
      toast.success('Profilul a fost actualizat');
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Eroare la salvare');
    } finally {
      setLoading(false);
    }
  };

  const schimbaParola = async () => {
    if (!parole.parola_curenta || !parole.parola_noua) {
      toast.warning('Completați toate câmpurile'); return;
    }
    if (parole.parola_noua.length < 8) {
      toast.warning('Parola nouă trebuie să aibă minim 8 caractere'); return;
    }
    if (parole.parola_noua !== parole.confirmare) {
      toast.warning('Parolele nu coincid'); return;
    }
    setLoading(true);
    try {
      await api.patch('/auth/schimba-parola', {
        parola_curenta: parole.parola_curenta,
        parola_noua: parole.parola_noua,
      });
      toast.success('Parola a fost schimbată cu succes');
      setParole({ parola_curenta: '', parola_noua: '', confirmare: '' });
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Parola curentă este incorectă');
    } finally {
      setLoading(false);
    }
  };

  const initiale = `${utilizator?.prenume?.[0] || ''}${utilizator?.nume?.[0] || ''}`.toUpperCase();

  const ROL_LABEL = {
    cetățean:              'Cetățean',
    funcționar:            'Funcționar DGASPC',
    medic:                 'Medic specialist',
    funcționar_primărie:   'Funcționar primărie',
    reprezentant_școală:   'Reprezentant școală',
    manager:               'Manager DGASPC',
    administrator:         'Administrator sistem',
  };

  const tabs = [
    { id: 'profil',   label: '👤 Date personale' },
    { id: 'securitate', label: '🔒 Securitate' },
    { id: 'sesiune',  label: 'ℹ️ Despre cont' },
  ];

  return (
    <Layout title="Profilul meu">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header profil */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
              {initiale}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
                {utilizator?.prenume} {utilizator?.nume}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>
                {ROL_LABEL[utilizator?.rol] || utilizator?.rol}
                {utilizator?.departament && ` · ${utilizator.departament}`}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
                {utilizator?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTabActiv(t.id)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer',
                borderRadius: 'calc(var(--radius) - 4px)', fontSize: 13.5,
                background: tabActiv === t.id ? 'var(--blue)' : 'transparent',
                color: tabActiv === t.id ? 'white' : 'var(--text-2)',
                fontFamily: 'inherit', fontWeight: tabActiv === t.id ? 500 : 400,
                transition: 'var(--transition)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Date personale ── */}
        {tabActiv === 'profil' && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 20 }}>Informații personale</div>

            <div className="form-row">
              <div className="form-group">
                <label>Prenume</label>
                <input type="text" className="form-input" value={form.prenume} onChange={set('prenume')} />
              </div>
              <div className="form-group">
                <label>Nume de familie</label>
                <input type="text" className="form-input" value={form.nume} onChange={set('nume')} />
              </div>
            </div>

            <div className="form-group">
              <label>Adresă email</label>
              <input type="email" className="form-input" value={form.email} onChange={set('email')} />
            </div>

            <div className="form-group">
              <label>Număr de telefon</label>
              <input type="tel" className="form-input" value={form.telefon} onChange={set('telefon')} placeholder="07xx xxx xxx" />
            </div>

            <div className="form-group">
              <label>CNP</label>
              <input type="text" className="form-input" value={utilizator?.cnp || '—'} disabled
                style={{ opacity: 0.6, fontFamily: 'DM Mono, monospace', letterSpacing: 2 }} />
              <p className="form-hint">CNP-ul nu poate fi modificat. Contactați administratorul dacă există o eroare.</p>
            </div>

            <div className="form-group">
              <label>Rol în platformă</label>
              <input type="text" className="form-input" value={ROL_LABEL[utilizator?.rol] || ''} disabled style={{ opacity: 0.6 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={salveazaProfil} disabled={loading}>
                {loading ? <><div className="loading-spinner" /> Se salvează...</> : '💾 Salvează modificările'}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Securitate ── */}
        {tabActiv === 'securitate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 20 }}>Schimbare parolă</div>

              <div className="form-group">
                <label>Parola curentă</label>
                <input type="password" className="form-input"
                  placeholder="Parola curentă" value={parole.parola_curenta} onChange={setP('parola_curenta')} />
              </div>
              <div className="form-group">
                <label>Parola nouă</label>
                <input type="password" className="form-input"
                  placeholder="Minim 8 caractere" value={parole.parola_noua} onChange={setP('parola_noua')} />
                {parole.parola_noua && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
                    {['Lungime ≥8', 'Literă mare', 'Cifră', 'Special'].map((req, i) => {
                      const checks = [
                        parole.parola_noua.length >= 8,
                        /[A-Z]/.test(parole.parola_noua),
                        /\d/.test(parole.parola_noua),
                        /[^A-Za-z0-9]/.test(parole.parola_noua),
                      ];
                      return (
                        <span key={req} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: checks[i] ? 'var(--success-bg)' : 'var(--danger-bg)', color: checks[i] ? 'var(--success)' : 'var(--danger)' }}>
                          {checks[i] ? '✓' : '✗'} {req}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Confirmare parolă nouă</label>
                <input type="password" className="form-input"
                  placeholder="Repetați parola nouă" value={parole.confirmare} onChange={setP('confirmare')} />
                {parole.confirmare && parole.parola_noua !== parole.confirmare && (
                  <p className="form-error">Parolele nu coincid</p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={schimbaParola} disabled={loading}>
                  {loading ? <><div className="loading-spinner" /> Se schimbă...</> : '🔒 Schimbă parola'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Autentificare în doi pași (2FA)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                    2FA este <strong style={{ color: 'var(--success)' }}>activată</strong> pe contul dvs.
                  </p>
                </div>
                <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
                  ✅ Activat
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Despre cont ── */}
        {tabActiv === 'sesiune' && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Informații despre cont</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['ID utilizator', `#${utilizator?.id}`],
                ['Tip cont', ROL_LABEL[utilizator?.rol] || utilizator?.rol],
                ['Email', utilizator?.email],
                ['Platformă', 'DGASPC Digital v1.0'],
                ['Sesiune', 'Activă (token JWT)'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500, fontFamily: label === 'ID utilizator' ? 'DM Mono, monospace' : 'inherit' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}