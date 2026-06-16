import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
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
  const { id } = useParams();
  const { utilizator } = useAuth();
  const navigate = useNavigate();
  
  const [dosar, setDosar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [motiv, setMotiv] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileRef = useRef(null);
  const rol = utilizator?.rol;
  const canEditStatus = ['manager', 'administrator'].includes(rol);

  const isMedic = rol === 'medic';
  const isFunctionar = rol === 'funcționar';
  const isCetatean = rol === 'cetățean';
  
  const [showDocsBox, setShowDocsBox] = useState(false);
  const [docsSuplimentare, setDocsSuplimentare] = useState('');
  
  // State-uri Programare Cetățean
  const [dataSelectata, setDataSelectata] = useState('');
  const [oraSelectata, setOraSelectata] = useState('09:00');
  
  // State-uri Decizie Comisie Funcționar
  const [comisieActiune, setComisieActiune] = useState('');
  const [comisieDate, setComisieDate] = useState({ grad: 'mediu', revizuire: '12', motiv: '' });

  // State-uri Formular Medic de Familie
  const [formDataMedic, setFormDataMedic] = useState({
    anamneza: '',
    diagnostic_principal: '',
    diagnostic_secundar: '',
    internari: [],
    deplasabil: 'este deplasabilă (deplasare autonomă sau sprijin din partea unei persoane / cu dispozitive)'
  });
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const handleActionFunctionar = async (statusNou, suplimentareText = null) => {
    setSavingStatus(true);
    try {
      await api.patch(`/dosare/${id}/status`, { status: statusNou, documente_suplimentare: suplimentareText });
      toast.success('Acțiune realizată cu succes!');
      setShowDocsBox(false);
      fetchDosar();
    } catch (err) {
      toast.error('Eroare la trimiterea solicitării');
    } finally { setSavingStatus(false); }
  };

  const aprobaDocument = async (docId) => {
    try {
      await api.patch(`/dosare/document/${docId}/aprobare`);
      setDosar(prev => ({
        ...prev,
        Documents: (prev.Documents || prev.documente || []).map(d => d.id === docId ? { ...d, validat: true } : d)
      }));
      toast.success('Document aprobat!');
    } catch (err) { toast.error('Eroare la aprobare document'); }
  };

  const handleFinalizareComisie = async () => {
    if (comisieActiune === 'respinge' && !comisieDate.motiv) return toast.warning('Introduceți motivul!');
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/finalizare-comisie`, {
        actiune: comisieActiune,
        grad: comisieDate.grad,
        revizuire_luni: comisieDate.revizuire,
        motiv: comisieDate.motiv
      });
      toast.success(comisieActiune === 'aproba' ? 'Certificat emis cu succes!' : 'Dosar respins!');
      setComisieActiune('');
      fetchDosar();
    } catch (err) {
      toast.error('Eroare la procesare');
    } finally { setSavingStatus(false); }
  };

  const handleSalveazaProgramare = async () => {
    if (!dataSelectata) return toast.warning('Selectați o dată!');
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/programeaza`, { data_programare: dataSelectata, ora: oraSelectata });
      toast.success('Programare fixată cu succes!');
      fetchDosar();
    } catch { toast.error('Eroare la salvarea programării.'); } finally { setSavingStatus(false); }
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

  const getVarstaDinCnp = (cnp) => {
    if (!cnp || cnp.length !== 13) return '-';
    let an = parseInt(cnp.substring(1, 3));
    let luna = parseInt(cnp.substring(3, 5));
    let zi = parseInt(cnp.substring(5, 7));
    const sex = parseInt(cnp.charAt(0));
    if (sex === 1 || sex === 2) an += 1900;
    else if (sex === 5 || sex === 6) an += 2000;
    else return '-';
    
    let astazi = new Date();
    let dataNasterii = new Date(an, luna - 1, zi);
    let varsta = astazi.getFullYear() - dataNasterii.getFullYear();
    let m = astazi.getMonth() - dataNasterii.getMonth();
    if (m < 0 || (m === 0 && astazi.getDate() < dataNasterii.getDate())) {
      varsta--;
    }
    return varsta;
  };

  const getNext10BusinessDays = () => {
    const dates = [];
    let current = new Date();
    while (dates.length < 10) {
      current.setDate(current.getDate() + 1);
      if (current.getDay() !== 0 && current.getDay() !== 6) dates.push(new Date(current));
    }
    return dates;
  };

  // Canvas Olograf Medic
  const startDrawing = (e) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };
  const stopDrawing = () => { setIsDrawing(false); };
  const curataSemnatura = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const finalizeazaScrisoare = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas');
    blankCanvas.width = canvasRef.current.width;
    blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) {
      toast.error('Vă rugăm să semnați documentul!');
      return;
    }
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/scrisoare-medicala`, {
        nume: cetatean.nume,
        prenume: cetatean.prenume,
        cnp: cetatean.cnp,
        varsta: getVarstaDinCnp(cetatean.cnp),
        ...formDataMedic,
        semnatura_base64: semnaturaBase64
      });
      toast.success('Scrisoarea medicală a fost generată și atașată!');
      fetchDosar();
    } catch {
      toast.error('Eroare la generarea scrisorii medicale');
    } finally {
      setSavingStatus(false);
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
          const done = i < idx;
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

  if (loading || !dosar) return <Layout title="Dosar"><div className="loading-spinner" style={{ margin: '60px auto' }} /></Layout>;

  const cetatean = dosar.cetatean || {};
  const functionar = dosar.functionar || null;
  const documenteAtasate = dosar.Documents || dosar.documente || dosar.Documente || [];
  const programareExistenta = dosar.ProgramareComisies?.[0] || dosar.programari?.[0] || dosar.Programari?.[0] || null;
  const esteFinalizat = dosar.status === 'programat_comisie' || dosar.status === 'aprobat' || dosar.status === 'respins';
  const comisieTrecuta = programareExistenta && new Date(programareExistenta.data_ora) < new Date();

  return (
    <Layout title={`Dosar ${dosar.numar_dosar}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-2)' }}>
        <button onClick={() => navigate('/dosare')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)' }}>← Înapoi la dosare</button>
        <span>/</span><span style={{ fontFamily: 'DM Mono' }}>{dosar.numar_dosar}</span>
      </div>

      {isFunctionar ? (
        /* ── LAYOUT EXCLUSIV FUNCȚIONAR (Single-Column Curat) ── */
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ fontSize: 14 }}>Dosar: <strong style={{ color: 'var(--blue)' }}>{dosar.numar_dosar}</strong> ({TIP_LABEL[dosar.tip] || dosar.tip})</div>
            <div>Status curent: <span className={`badge badge-${dosar.status}`}>{STATUS_LABEL[dosar.status]}</span></div>
          </div>

          <div className="card" style={{ padding: 24, borderTop: '4px solid var(--blue)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Cetățean</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 24 }}>
              <div>Nume complet: <strong>{cetatean.prenume} {cetatean.nume}</strong></div>
              <div>CNP: <strong>{cetatean.cnp || '—'}</strong></div>
              <div>Telefon: <strong>{cetatean.telefon || '—'}</strong></div>
              <div>E-mail: <strong>{cetatean.email || '—'}</strong></div>
            </div>

            {programareExistenta && (
              <div style={{ padding: 16, background: '#e6f4ea', border: '1px solid #34a853', borderRadius: 8, marginBottom: 24 }}>
                <h4 style={{ color: '#137333', margin: 0 }}>📅 Programare Comisie Fixată de Cetățean</h4>
                <p style={{ margin: '6px 0 0 0', fontSize: 13.5 }}>
                  Data: <strong>{new Date(programareExistenta.data_ora).toLocaleDateString('ro-RO')}</strong> · 
                  Ora: <strong>{new Date(programareExistenta.data_ora).toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'})}</strong>
                </p>
              </div>
            )}

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📁 Documente Încărcate</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              {documenteAtasate.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 500 }}>{doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {doc.cale_fisier && <a href={`http://localhost:5000/${doc.cale_fisier.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}>👁️ Vizualizare</a>}
                    
                    {doc.validat ? (
                      <span style={{ fontSize: 12.5, color: '#137333', fontWeight: 600, background: '#e6f4ea', padding: '4px 10px', borderRadius: 20 }}>✓ Aprobat</span>
                    ) : !esteFinalizat && (
                      <>
                        <button className="btn btn-sm" style={{ background: '#e6f4ea', color: '#137333', border: 'none', padding: '5px 10px', fontSize: 12 }} onClick={() => aprobaDocument(doc.id)}>✓ Aprobare</button>
                        <button className="btn btn-sm" style={{ background: '#fce8e6', color: '#c5221f', border: 'none', padding: '5px 10px', fontSize: 12 }} onClick={() => { setShowDocsBox(true); setDocsSuplimentare(prev => prev ? `${prev}\n- Retrimitere: ${doc.nume_fisier || doc.tip_document}` : `- Retrimitere: ${doc.nume_fisier || doc.tip_document}`); }}>⚠️ Cere retrimitere</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!esteFinalizat ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowDocsBox(!showDocsBox)} style={{ flex: 1, height: 40 }}>➕ Cere documente suplimentare</button>
                  <button className="btn" style={{ background: 'indigo', color: '#fff', flex: 1, height: 40, fontWeight: 'bold' }} onClick={() => handleActionFunctionar('programat_comisie')}>📋 Validare dosar și programare la comisie</button>
                </div>
                {showDocsBox && (
                  <div style={{ padding: 16, background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8 }}>
                    <textarea className="form-textarea" rows="4" value={docsSuplimentare} onChange={(e) => setDocsSuplimentare(e.target.value)} placeholder="Introduceți lista documentelor..." />
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 10, float: 'right' }} onClick={() => handleActionFunctionar('incomplet', docsSuplimentare)}>✉️ Trimite solicitarea pe Email</button>
                  </div>
                )}
              </div>
            ) : dosar.status === 'programat_comisie' && !comisieTrecuta ? (
              <div style={{ padding: 16, background: '#e6f4ea', color: '#137333', textAlign: 'center', borderRadius: 8, fontWeight: 600 }}>
                ✓ Dosarul a fost validat și trimis la comisie. Se așteaptă data programării.
              </div>
            ) : null}

            {dosar.status === 'programat_comisie' && comisieTrecuta && (
              <div style={{ marginTop: 30, padding: 20, border: '2px solid indigo', borderRadius: 8, background: '#f8f9fa' }}>
                <h3 style={{ color: 'indigo', marginBottom: 15 }}>⚖️ Decizie Finală Comisie</h3>
                {!comisieActiune ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={() => setComisieActiune('aproba')}>✅ Aprobă dosar și generare certificat</button>
                    <button className="btn" style={{ background: '#dc3545', color: 'white' }} onClick={() => setComisieActiune('respinge')}>❌ Respinge dosar</button>
                  </div>
                ) : (
                  <div>
                    {comisieActiune === 'aproba' && (
                      <div style={{ display: 'grid', gap: 12, marginBottom: 15 }}>
                        <div className="form-group">
                          <label>Severitate Handicap</label>
                          <select className="form-select" value={comisieDate.grad} onChange={e => setComisieDate({...comisieDate, grad: e.target.value})}>
                            <option value="usor">Ușor</option>
                            <option value="mediu">Mediu</option>
                            <option value="accentuat">Accentuat</option>
                            <option value="grav">Grav</option>
                            <option value="grav cu asistent personal">Grav cu asistent personal</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Termen de revizuire</label>
                          <select className="form-select" value={comisieDate.revizuire} onChange={e => setComisieDate({...comisieDate, revizuire: e.target.value})}>
                            <option value="3">3 Luni</option>
                            <option value="6">6 Luni</option>
                            <option value="12">12 Luni</option>
                            <option value="24">24 Luni</option>
                            <option value="nelimitat">Nelimitat (Permanent)</option>
                          </select>
                        </div>
                      </div>
                    )}
                    {comisieActiune === 'respinge' && (
                      <div className="form-group" style={{ marginBottom: 15 }}>
                        <label>Motivul respingerii (va fi trimis pe e-mail)</label>
                        <textarea className="form-textarea" rows="3" value={comisieDate.motiv} onChange={e => setComisieDate({...comisieDate, motiv: e.target.value})}></textarea>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary" onClick={handleFinalizareComisie} disabled={savingStatus}>Confirmă decizia</button>
                      <button className="btn btn-ghost" onClick={() => setComisieActiune('')}>Anulează</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {dosar.status === 'aprobat' && <div style={{ marginTop: 20, padding: 16, background: '#e6f4ea', color: '#137333', textAlign: 'center', borderRadius: 8, fontWeight: 600 }}>✓ Dosar finalizat. Certificatul a fost emis.</div>}
            {dosar.status === 'respins' && <div style={{ marginTop: 20, padding: 16, background: '#fce8e6', color: '#c5221f', textAlign: 'center', borderRadius: 8, fontWeight: 600 }}>❌ Dosar respins definitiv.</div>}
          </div>
        </div>
      ) : isMedic ? (
        /* ── LAYOUT EXCLUSIV MEDIC (Single-Column Curat - Doar Date + Formular Specific) ── */
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ fontSize: 14 }}>Cerere Pacient: <strong style={{ color: 'var(--blue)' }}>{dosar.numar_dosar}</strong></div>
            <div>Status Solicitare: <span className={`badge badge-incomplet`}>⏳ În așteptare completare</span></div>
          </div>

          <div className="card" style={{ padding: 24, borderTop: '4px solid var(--blue)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Pacient (Cetățean)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 24, fontSize: 13.5 }}>
              <div>Nume complet: <strong>{cetatean.prenume} {cetatean.nume}</strong></div>
              <div>CNP: <strong>{cetatean.cnp || '—'}</strong></div>
              <div>Telefon: <strong>{cetatean.telefon || '—'}</strong></div>
              <div>E-mail: <strong>{cetatean.email || '—'}</strong></div>
              <div>Vârstă: <strong>{getVarstaDinCnp(cetatean.cnp)} ani</strong></div>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)', borderTop: '1px solid var(--border)', paddingTop: 20 }}>📄 Completare Scrisoare Medicală</h3>
            
            <div className="form-group">
              <label>1. Anamneza (antecedente personale patologice)</label>
              <textarea className="form-textarea" rows="3" value={formDataMedic.anamneza} onChange={e => setFormDataMedic({...formDataMedic, anamneza: e.target.value})}></textarea>
            </div>

            <div className="form-group">
              <label>2. Diagnosticul medical (Principal)</label>
              <input type="text" className="form-input" value={formDataMedic.diagnostic_principal} onChange={e => setFormDataMedic({...formDataMedic, diagnostic_principal: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Diagnosticul medical (Secundar / altele)</label>
              <textarea className="form-textarea" rows="2" value={formDataMedic.diagnostic_secundar} onChange={e => setFormDataMedic({...formDataMedic, diagnostic_secundar: e.target.value})}></textarea>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 600 }}>Internări în spital</label>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFormDataMedic(f => ({...f, internari: [...f.internari, { data_inceput: '', data_sfarsit: '', unitate: '', diagnostic: '' }]}))}>+ Adaugă internare</button>
              </div>
              {formDataMedic.internari.map((int, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 2fr auto', gap: 8, marginTop: 10, padding: 10, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <input type="date" className="form-input" value={int.data_inceput} onChange={e => { const u = [...formDataMedic.internari]; u[i].data_inceput = e.target.value; setFormDataMedic({...formDataMedic, internari: u}); }} />
                  <input type="date" className="form-input" value={int.data_sfarsit} onChange={e => { const u = [...formDataMedic.internari]; u[i].data_sfarsit = e.target.value; setFormDataMedic({...formDataMedic, internari: u}); }} />
                  <input type="text" className="form-input" placeholder="Spital" value={int.unitate} onChange={e => { const u = [...formDataMedic.internari]; u[i].unitate = e.target.value; setFormDataMedic({...formDataMedic, internari: u}); }} />
                  <input type="text" className="form-input" placeholder="Diagnostic ieșire" value={int.diagnostic} onChange={e => { const u = [...formDataMedic.internari]; u[i].diagnostic = e.target.value; setFormDataMedic({...formDataMedic, internari: u}); }} />
                  <button type="button" className="btn btn-sm text-danger" onClick={() => setFormDataMedic({...formDataMedic, internari: formDataMedic.internari.filter((_, idx) => idx !== i)})}>X</button>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Starea de deplasabilitate</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <label style={{ fontWeight: 'normal', display: 'flex', gap: 8 }}><input type="radio" name="depl" checked={formDataMedic.deplasabil.includes('este deplasabilă')} onChange={() => setFormDataMedic({...formDataMedic, deplasabil: 'este deplasabilă (deplasare autonomă sau sprijin din partea unei persoane / cu dispozitive)'})} /> Persoana - este deplasabilă (deplasare autonomă sau sprijin din partea unei persoane / cu dispozitive)</label>
                <label style={{ fontWeight: 'normal', display: 'flex', gap: 8 }}><input type="radio" name="depl" checked={formDataMedic.deplasabil.includes('nu este deplasabilă')} onChange={() => setFormDataMedic({...formDataMedic, deplasabil: 'nu este deplasabilă (nu poate fi deplasat ajutat de o persoană sau cu scaunul rulant)'})} /> Persoana - nu este deplasabilă (nu poate fi deplasat ajutat de o persoană sau cu scaunul rulant)</label>
              </div>
            </div>

            <div className="form-group">
              <label>Semnătura Medicului de Familie</label>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 8, width: 400, background: '#fff', marginTop: 6 }}><canvas ref={canvasRef} width={400} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} style={{ cursor: 'crosshair' }} /></div>
              <button type="button" onClick={curataSemnatura} className="text-link" style={{ marginTop: 5, background: 'none', border: 'none', fontSize: 12 }}>Curăță semnătura</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={finalizeazaScrisoare} disabled={savingStatus}>
                {savingStatus ? 'Se generează...' : '✓ Finalizare Scrisoare Medicală'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── LAYOUT STANDARD CETĂȚEAN / ADMIN / MANAGER (Two-Columns cu Timeline Active) ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Caseta Programare pentru Cetățean */}
            {isCetatean && dosar.status === 'programat_comisie' && (
              <div className="card" style={{ border: '2px solid var(--blue)', background: '#f8fafc', padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--blue)' }}>📅 Stabilește Data Programării la Comisie</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Te rugăm să îți alegi o zi convenabilă din următoarele 10 zile lucrătoare:</p>
                {programareExistenta ? (
                  <div style={{ padding: 12, background: '#e6f4ea', color: '#137333', borderRadius: 6, fontWeight: 500 }}>
                    ✓ Ești programat cu succes în data de: {new Date(programareExistenta.data_ora).toLocaleDateString('ro-RO')} la ora {new Date(programareExistenta.data_ora).toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'})}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Alege Ziua</label>
                      <select className="form-select" value={dataSelectata} onChange={e => setDataSelectata(e.target.value)}>
                        <option value="">-- Selectează o zi --</option>
                        {getNext10BusinessDays().map((date, idx) => (<option key={idx} value={date.toISOString().split('T')[0]}>{date.toLocaleDateString('ro-RO')}</option>))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Ora</label>
                      <select className="form-select" value={oraSelectata} onChange={e => setOraSelectata(e.target.value)}>
                        <option value="09:00">09:00</option><option value="10:00">10:00</option><option value="11:00">11:00</option><option value="12:00">12:00</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={handleSalveazaProgramare} disabled={savingStatus}>Confirmă</button>
                  </div>
                )}
              </div>
            )}

            {/* Header Status */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--blue)', background: 'var(--blue-pale)', padding: '3px 10px', borderRadius: 20 }}>{dosar.numar_dosar}</span>
                    <span className={`badge badge-${dosar.status}`}>{STATUS_LABEL[dosar.status]}</span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>{TIP_LABEL[dosar.tip] || dosar.tip}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Departament: {dosar.departament || '—'}</p>
                </div>
                {canEditStatus && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditStatus(!editStatus)}>Modifică status</button>
                )}
              </div>
              {editStatus && canEditStatus && (
                <div style={{ marginTop: 20, padding: 16, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div className="form-group">
                    <label>Noul status</label>
                    <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={saveStatus} disabled={savingStatus}>Aplica</button>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Descrierea situației</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{dosar.descriere || 'Nicio descriere furnizată.'}</p>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Documente atașate</div>
                <div>
                  <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={uploadDocument} />
                  <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>+ Adaugă</button>
                </div>
              </div>
              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>{doc.nume_fisier || doc.tip_document}</div>
                    {doc.cale_fisier && <a href={`http://localhost:5000/${doc.cale_fisier.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Deschide PDF</a>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coloana Dreaptă Standard: Progres și Funcționar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Progresul dosarului</div>
              <Timeline status={dosar.status} />
            </div>
            {functionar && (
              <div className="card">
                <div className="card-title">Funcționar alocat</div>
                <div style={{ fontSize: 13 }}>{functionar.prenume} {functionar.nume}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}