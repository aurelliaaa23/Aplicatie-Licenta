import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import SignaturePad from 'signature_pad';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = [
  { value: 'in_analiza',         label: '📋 În analiză' },
  { value: 'incomplet',          label: '⚠️ Incomplet — necesită completări' },
  { value: 'programat_comisie',  label: '📅 Programat la comisie' },
  { value: 'aprobat',            label: '✅ Aprobat' },
  { value: 'respins',            label: '❌ Respins' },
  { value: 'arhivat',            label: '🗂 Arhivat' },
];

const STATUS_LABEL = {
  depus: 'Depus', in_analiza: 'În analiză', incomplet: 'Incomplet',
  programat_comisie: 'Programat comisie', aprobat: 'Aprobat',
  respins: 'Respins', arhivat: 'Arhivat',
};

const TIP_LABEL = {
  certificat_handicap: 'Certificat handicap', adoptie: 'Adopție',
  plasament: 'Plasament familial', alocatie: 'Alocație',
  evaluare_adulti: 'Evaluare adulți', alte_servicii: 'Alte servicii',
};

const DOC_TIP_LABEL = {
  carte_identitate: 'Carte identitate', certificat_medical: 'Certificat medical',
  ancheta_sociala: 'Anchetă socială', referat: 'Referat',
  decizie: 'Decizie', semnatura: 'Semnătură electronică', alte: 'Alt document',
};

export default function DosarDetaliu() {
  const { id }      = useParams();
  const { utilizator } = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  
  const solicitare  = location.state?.solicitare;
  
  const [dosar, setDosar]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus]   = useState('');
  const [motiv, setMotiv]           = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploading, setUploading]   = useState(false);
  
  const fileRef = useRef(null);

  const rol = utilizator?.rol;
  const canEditStatus = ['funcționar', 'manager', 'administrator'].includes(rol);

  // State formular medic
  const [formMed, setFormMed] = useState({ anamneza: '', diag_princ: '', diag_sec: '', deplasabil: 'da' });
  const [internari, setInternari] = useState([]);
  const canvasRef = useRef(null);
  const signPadRef = useRef(null);
  const [submittingMed, setSubmittingMed] = useState(false);

  useEffect(() => { fetchDosar(); }, [id]);

  const fetchDosar = async () => {
    try {
      const { data } = await api.get(`/dosare/${id}`);
      setDosar(data);
      setNewStatus(data.status);
      setMotiv(data.motiv_respingere || '');
    } catch {
      toast.error('Dosarul nu a putut fi încărcat');
      navigate('/dosare');
    } finally {
      setLoading(false);
    }
  };

  const documenteAtasate = dosar?.Documents || dosar?.documente || dosar?.Documente || [];
  const scrisoareExistenta = documenteAtasate.find(d => d.tip_document === 'certificat_medical');
  const esteFinalizat = solicitare?.status === 'finalizat' || scrisoareExistenta;

  useEffect(() => {
    if (rol === 'medic' && solicitare && !esteFinalizat && !loading) {
      setTimeout(() => {
        if (canvasRef.current && !signPadRef.current) {
          signPadRef.current = new SignaturePad(canvasRef.current, { backgroundColor: 'rgb(255, 255, 255)', penColor: '#1e2f5c' });
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvasRef.current.width = canvasRef.current.offsetWidth * ratio;
          canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
          canvasRef.current.getContext("2d").scale(ratio, ratio);
        }
      }, 200);
    }
  }, [rol, solicitare, esteFinalizat, loading]);

  const saveStatus = async () => {
    if (!newStatus) return;
    if (newStatus === 'respins' && !motiv.trim()) {
      toast.warning('Introduceți motivul respingerii');
      return;
    }
    setSavingStatus(true);
    try {
      await api.patch(`/dosare/${id}/status`, {
        status: newStatus,
        motiv_respingere: newStatus === 'respins' ? motiv : null,
      });
      toast.success('Status actualizat cu succes');
      setEditStatus(false);
      fetchDosar();
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Eroare la actualizare status');
    } finally {
      setSavingStatus(false);
    }
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('fisier', file);
      fd.append('dosar_id', id);
      fd.append('tip_document', 'alte');
      await api.post('/documente/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document adăugat cu succes');
      fetchDosar(); 
    } catch {
      toast.error('Eroare la încărcarea documentului');
    } finally {
      setUploading(false);
    }
  };

  const updateInternare = (index, field, value) => {
    const noi = [...internari];
    noi[index][field] = value;
    setInternari(noi);
  };

  const submitScrisoare = async (e) => {
    e.preventDefault();
    if (!formMed.anamneza || !formMed.diag_princ) return toast.warning('Completați anamneza și diagnosticul principal!');
    let sigData = null;
    if (signPadRef.current && !signPadRef.current.isEmpty()) {
      sigData = signPadRef.current.toDataURL('image/png');
    } else {
      return toast.warning('Vă rugăm să semnați documentul!');
    }

    setSubmittingMed(true);
    try {
      await api.post('/documente/genereaza-scrisoare-medicala', {
        solicitare_id: solicitare.id,
        dosar_id: dosar.id,
        cetatean: dosar.cetatean,
        ...formMed,
        internari,
        semnatura_base64: sigData
      });
      toast.success('Scrisoarea a fost generată cu succes!');
      navigate('/dosare'); 
    } catch (err) {
      toast.error('Eroare la generarea scrisorii medicale');
    } finally {
      setSubmittingMed(false);
    }
  };

  const Timeline = ({ status }) => {
    const all = ['depus', 'in_analiza', 'programat_comisie', 'aprobat'];
    const rejected = ['respins', 'incomplet', 'arhivat'].includes(status);
    const steps = rejected ? ['depus', 'in_analiza', status] : all;
    const idx = steps.indexOf(status);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 28 }}>
        {steps.map((s, i) => {
          const done  = i < idx;
          const active = i === idx;
          return (
            <div key={s} style={{ position: 'relative', paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', left: -21, top: 20, width: 2, height: '100%', background: done ? 'var(--blue)' : 'var(--border)' }} />
              )}
              <div style={{ position: 'absolute', left: -28, top: 2, width: 16, height: 16, borderRadius: '50%', background: active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)', border: '2px solid white', boxShadow: '0 0 0 2px ' + (active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)') }} />
              <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : done ? 'var(--text-2)' : 'var(--text-3)' }}>
                {STATUS_LABEL[s]}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading || !dosar) return (
    <Layout title="Dosar">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
      </div>
    </Layout>
  );

  const cetatean = dosar.cetatean || {};
  const functionar = dosar.functionar || null;

  // ── VIZUALIZARE 1: MEDICUL A COMPLETAT DEJA SCRISOAREA (AFIȘARE DIRECTĂ PDF) ──
  if (rol === 'medic' && esteFinalizat) {
    return (
      <Layout title={`Scrisoare Medicală Completată - Dosar ${dosar.numar_dosar}`}>
        <div style={{ maxWidth: 650, margin: '40px auto', textAlign: 'center' }}>
          <div className="card" style={{ padding: '40px 32px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--text-1)' }}>
              Scrisoare Medicală Înregistrată
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Ați finalizat cu succes documentul oficial pentru pacientul <strong>{cetatean.prenume} {cetatean.nume}</strong>.<br />
              Formularul este blocat pentru editare. Faceți click mai jos pentru a vizualiza documentul generat.
            </p>
            {scrisoareExistenta?.cale_fisier ? (
              <a 
                href={`http://localhost:5000/${scrisoareExistenta.cale_fisier.replace(/\\/g, '/')}`}
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-primary"
                style={{ display: 'inline-block', textDecoration: 'none', padding: '12px 24px' }}
              >
                👁️ Deschide PDF Scrisoare Medicală
              </a>
            ) : (
              <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>Documentul PDF se procesează...</p>
            )}
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dosare')}>
                ← Înapoi la solicitări
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── VIZUALIZARE 2: MEDICUL TREBUIE SĂ COMPLETEZE FORMULARUL (FĂRĂ REZUMATE/SIDEBAR) ──
  if (rol === 'medic' && solicitare && !esteFinalizat) {
    return (
      <Layout title={`Completare Scrisoare Medicală - Dosar ${dosar.numar_dosar}`}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: 20 }}>
              <div>
                <div className="card-title">Completare Scrisoare Medicală / Referat</div>
                <div className="card-subtitle">Completați datele de mai jos. La finalizare, sistemul va genera PDF-ul oficial.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 24 }}>
              <div><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Pacient:</span> <br/> <strong style={{ fontSize: 14 }}>{cetatean.nume} {cetatean.prenume}</strong></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-3)' }}>CNP:</span> <br/> <strong style={{ fontSize: 14 }}>{cetatean.cnp}</strong></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Telefon:</span> <br/> <strong style={{ fontSize: 14 }}>{cetatean.telefon || '—'}</strong></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Email:</span> <br/> <strong style={{ fontSize: 14 }}>{cetatean.email}</strong></div>
            </div>

            <form onSubmit={submitScrisoare}>
              <div className="form-group">
                <label>1. Anamneza (antecedente personale patologice) *</label>
                <textarea className="form-textarea" rows="4" value={formMed.anamneza} onChange={(e) => setFormMed({...formMed, anamneza: e.target.value})} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>2. Diagnostic principal *</label>
                  <input type="text" className="form-input" value={formMed.diag_princ} onChange={(e) => setFormMed({...formMed, diag_princ: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Alte diagnostice (secundare)</label>
                  <input type="text" className="form-input" value={formMed.diag_sec} onChange={(e) => setFormMed({...formMed, diag_sec: e.target.value})} />
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-1)' }}>3. Internări în spital</h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInternari([...internari, { de_la: '', pana_la: '', spital: '', diagnostic: '' }])}>
                    + Adaugă internare
                  </button>
                </div>
                
                {internari.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Fără internări adăugate.</p> : null}
                
                {internari.map((int, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 3fr auto', gap: 10, background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 10, alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: 11 }}>De la</label><input type="date" className="form-input" value={int.de_la} onChange={(e) => updateInternare(i, 'de_la', e.target.value)} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: 11 }}>Până la</label><input type="date" className="form-input" value={int.pana_la} onChange={(e) => updateInternare(i, 'pana_la', e.target.value)} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: 11 }}>Spital</label><input type="text" className="form-input" value={int.spital} onChange={(e) => updateInternare(i, 'spital', e.target.value)} /></div>
                    <div className="form-group" style={{ marginBottom: 0 }}><label style={{ fontSize: 11 }}>Diagnostic</label><input type="text" className="form-input" value={int.diagnostic} onChange={(e) => updateInternare(i, 'diagnostic', e.target.value)} /></div>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', height: 38 }} onClick={() => setInternari(internari.filter((_, idx) => idx !== i))}>X</button>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 16, borderRadius: 8 }}>
                <label style={{ marginBottom: 12, fontSize: 14 }}>4. Persoana este deplasabilă?</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="radio" name="deplasabil" value="da" checked={formMed.deplasabil === 'da'} onChange={(e) => setFormMed({...formMed, deplasabil: e.target.value})} style={{ width: 18, height: 18 }} />
                    <strong>Da</strong> - (deplasare autonomă sau sprijin din partea unei persoane / cu dispozitive)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
                    <input type="radio" name="deplasabil" value="nu" checked={formMed.deplasabil === 'nu'} onChange={(e) => setFormMed({...formMed, deplasabil: e.target.value})} style={{ width: 18, height: 18 }} />
                    <strong>Nu</strong> - (nu poate fi deplasat ajutat de o persoană sau cu scaunul rulant)
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 24 }}>
                <label>Semnătură medic *</label>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: 150, touchAction: 'none' }} />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => signPadRef.current?.clear()} style={{ marginTop: 8 }}>Șterge semnătura</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30 }}>
                <button type="button" className="btn btn-secondary" onClick={() => navigate('/dosare')}>Anulează</button>
                <button type="submit" className="btn btn-success" disabled={submittingMed}>
                  {submittingMed ? 'Se generează...' : '✓ Finalizare și generare PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // ── VIZUALIZARE 3: INTERFAȚA STANDARD (CETĂȚENI / FUNCȚIONARI) ──
  return (
    <Layout title={`Dosar ${dosar.numar_dosar}`}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-2)' }}>
        <button onClick={() => navigate('/dosare')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 13 }}>
          ← Înapoi la dosare
        </button>
        <span>/</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{dosar.numar_dosar}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* Coloana stângă */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--blue)', background: 'var(--blue-pale)', padding: '3px 10px', borderRadius: 20 }}>
                    {dosar.numar_dosar}
                  </span>
                  <span className={`badge badge-${dosar.status}`}>{STATUS_LABEL[dosar.status]}</span>
                  {dosar.prioritate === 'urgent' && (
                    <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
                      🔴 Urgent
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                  {TIP_LABEL[dosar.tip] || dosar.tip}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Departament: {dosar.departament || '—'} · Depus la {new Date(dosar.creat_la).toLocaleDateString('ro-RO')}
                </p>
              </div>

              {canEditStatus && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditStatus(!editStatus)}>
                  ✏️ Modifică status
                </button>
              )}
            </div>

            {editStatus && canEditStatus && (
              <div style={{ marginTop: 20, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label>Noul status</label>
                  <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {newStatus === 'respins' && (
                  <div className="form-group">
                    <label>Motiv respingere *</label>
                    <textarea className="form-textarea" rows={3} placeholder="Explicați motivul respingerii..." value={motiv} onChange={(e) => setMotiv(e.target.value)} />
                  </div>
                )}
                {newStatus === 'incomplet' && (
                  <div className="form-group">
                    <label>Documente lipsă</label>
                    <textarea className="form-textarea" rows={3} placeholder="Specificați ce documente lipsesc..." value={motiv} onChange={(e) => setMotiv(e.target.value)} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={saveStatus} disabled={savingStatus}>Salvează statusul</button>
                  <button className="btn btn-ghost" onClick={() => setEditStatus(false)}>Anulează</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Descrierea situației</div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {dosar.descriere || 'Nicio descriere furnizată.'}
            </p>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Documente atașate</div>
                <div className="card-subtitle">{documenteAtasate.length} fișiere</div>
              </div>
              <div>
                <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={uploadDocument} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳ Se încarcă...' : '+ Adaugă document'}
                </button>
              </div>
            </div>

            {documenteAtasate.length === 0 ? (
              <div className="empty-state"><h3>Niciun document atașat încă</h3></div>
            ) : (
              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div style={{ flex: 1, paddingLeft: 8 }}>
                      <div className="file-name" style={{ fontSize: 14, fontWeight: 500 }}>{doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(doc.incarcat_la).toLocaleString('ro-RO')}</div>
                    </div>
                    {doc.cale_fisier && (
                      <a href={`http://localhost:5000/${doc.cale_fisier.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Deschide PDF</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coloana dreaptă */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Progresul dosarului</div>
            <Timeline status={dosar.status} />
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Cetățean</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>👤 Nume</div><div style={{ fontSize: 13.5 }}>{cetatean.prenume} {cetatean.nume}</div></div>
              <div><div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>📧 Email</div><div style={{ fontSize: 13.5 }}>{cetatean.email}</div></div>
            </div>
          </div>

          {functionar && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Funcționar alocat</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div><div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>👤 Nume</div><div style={{ fontSize: 13.5 }}>{functionar.prenume} {functionar.nume}</div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}