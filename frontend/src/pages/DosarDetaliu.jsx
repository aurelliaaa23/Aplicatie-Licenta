import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = [
  { value: 'in_analiza',               label: '📋 În analiză' },
  { value: 'incomplet',                label: '⚠️ Incomplet — necesită completări' },
  { value: 'programat_comisie',        label: '📅 Programat la comisie' },
  { value: 'aprobat',                  label: '✅ Decizie finală' },
  { value: 'respins',                  label: '❌ Respins' },
  { value: 'arhivat',                  label: '🗂 Arhivat' },
];

const STATUS_LABEL = {
  depus: 'Depus', in_analiza: 'În analiză', incomplet: 'Incomplet',
  in_asteptare_programare: 'În așteptare programare',
  programat_comisie: 'Programat comisie', aprobat: 'Decizie finală',
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
  decizie: 'Decizie (Certificat)', semnatura: 'Semnătură electronică', alte: 'Alt document',
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
  const isFunctionarPrimarie = rol === 'funcționar_primărie';
  
  const [showDocsBox, setShowDocsBox] = useState(false);
  const [docsSuplimentare, setDocsSuplimentare] = useState('');
  
  const [comisieActiune, setComisieActiune] = useState('');
  const [comisieDate, setComisieDate] = useState({ grad: 'mediu', revizuire: '12', motiv: '' });

  const [formDataMedic, setFormDataMedic] = useState({
    anamneza: '', diagnostic_principal: '', diagnostic_secundar: '', internari: [],
    deplasabil: 'este deplasabilă (deplasare autonomă sau sprijin din partea unei persoane / cu dispozitive)'
  });

  const [formDataPrimarie, setFormDataPrimarie] = useState({
    conditii_locuit: '', situatie_familiala: '', venituri: '', recomandare: ''
  });

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- STATE PENTRU MEDIC ---
  const [tipFormMedic, setTipFormMedic] = useState('familie'); // 'familie' sau 'specialist'
  const [formMedicFam, setFormMedicFam] = useState({
    anamneza: '', diagnostic_principal: '', diagnostic_secundar: '', internari: [], deplasabil: 'Este deplasabilă (autonomă/cu sprijin)'
  });
  const [formMedicSpec, setFormMedicSpec] = useState({
    diagnostic: '', evolutie_boala: 'Staționară', pronostic_viata: 'Bun', pronostic_vindecare: 'Bun',
    tratamente_urmate: '', raspuns_tratament: 'Bun', cooperare: 'Bună'
  });

  // --- STATE PENTRU PRIMARIE (MAMUT) ---
  const [formPrimarie, setFormPrimarie] = useState({
    ocupatia: '', studii: 'Medii', stare_civila: 'Necăsătorit', copii: 'Nu', detalii_copii: '',
    reprezentant_legal: 'Nu', detalii_reprezentant: '', igiena_corporala: 'Fără ajutor', imbracat_dezbracat: 'Fără ajutor',
    servire_hranire: 'Fără ajutor', mobilizare: 'Fără ajutor', deplasare_interior: 'Fără ajutor', deplasare_exterior: 'Fără ajutor',
    comunicare_mijloace: 'Fără ajutor', dispozitive_deplasare: 'Niciunul', preparare_hrana: 'Fără ajutor',
    activitati_gospodaresti: 'Fără ajutor', gestionare_venituri: 'Fără ajutor', cumparaturi: 'Fără ajutor',
    administrare_tratament: 'Fără ajutor', utilizare_transport: 'Fără ajutor', timp_liber: 'Fără ajutor',
    memorie: 'Își aduce aminte total', vaz: 'Completă fără ochelari', comunicare: 'Bună', orientare: 'Fără probleme',
    comportament: 'Bun', tip_locuinta: 'Casă', nr_camere: '2', incalzire: 'Centrală', apa_curenta: 'Da', dotari_locuinta: '',
    coabitare: 'Cu familia', coabitant_bolnav: 'Nu', coabitant_adictii: 'Nu', relatie_familie: 'Bună', risc_neglijare: 'Nu',
    risc_abuz: 'Nu', pers_contact: '', are_prieteni: 'Da', relatii_prietenie: 'Permanente', participare_comunitate: 'Da', concluzii: ''
  });

  const setPF = (k, v) => setFormPrimarie(prev => ({ ...prev, [k]: v }));

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
    if (newStatus === 'respins' && !motiv.trim()) return toast.warning('Introduceți motivul respingerii');
    setSavingStatus(true);
    try {
      await api.patch(`/dosare/${id}/status`, { status: newStatus, motiv_respingere: newStatus === 'respins' ? motiv : null });
      toast.success('Status actualizat');
      setEditStatus(false);
      fetchDosar();
    } catch { toast.error('Eroare la actualizare status'); } finally { setSavingStatus(false); }
  };

  const handleActionFunctionar = async (statusNou, suplimentareText = null) => {
    setSavingStatus(true);
    try {
      await api.patch(`/dosare/${id}/status`, { status: statusNou, documente_suplimentare: suplimentareText });
      toast.success('Acțiune realizată cu succes!');
      setShowDocsBox(false); fetchDosar();
    } catch { toast.error('Eroare la trimiterea solicitării'); } finally { setSavingStatus(false); }
  };

  const aprobaDocument = async (docId) => {
    try {
      await api.patch(`/dosare/document/${docId}/aprobare`);
      setDosar(prev => ({ ...prev, Documents: (prev.Documents || prev.documente || []).map(d => d.id === docId ? { ...d, validat: true } : d) }));
      toast.success('Document aprobat!');
    } catch { toast.error('Eroare la aprobare'); }
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
      fetchDosar(); // Reîncărcăm dosarul ca să apară noul PDF și statusul
    } catch { toast.error('Eroare la procesare'); } finally { setSavingStatus(false); }
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('fisier', file); fd.append('dosar_id', id); fd.append('tip_document', 'alte');
      await api.post('/documente/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document adăugat'); fetchDosar();
    } catch { toast.error('Eroare'); } finally { setUploading(false); }
  };

  const getVarstaDinCnp = (cnp) => {
    if (!cnp || cnp.length !== 13) return '-';
    let an = parseInt(cnp.substring(1, 3)); let luna = parseInt(cnp.substring(3, 5)); let zi = parseInt(cnp.substring(5, 7));
    const sex = parseInt(cnp.charAt(0));
    if (sex === 1 || sex === 2) an += 1900; else if (sex === 5 || sex === 6) an += 2000; else return '-';
    let astazi = new Date(); let dataNasterii = new Date(an, luna - 1, zi);
    let varsta = astazi.getFullYear() - dataNasterii.getFullYear();
    if (astazi.getMonth() - dataNasterii.getMonth() < 0 || (astazi.getMonth() === dataNasterii.getMonth() && astazi.getDate() < dataNasterii.getDate())) varsta--;
    return varsta;
  };

  const startDrawing = (e) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); setIsDrawing(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke();
  };
  const stopDrawing = () => { setIsDrawing(false); };
  const curataSemnatura = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // --- TRIMITERE CĂTRE BACKEND CU CAPTURARE EROARE REALĂ ---
  const finalizeazaScrisoare = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați documentul!');
    
    setSavingStatus(true);
    try {
      const cetatean = dosar.cetatean;
      const domiciliu = `${cetatean.judet || ''}, ${cetatean.oras || ''}`;
      
      let payload = {
        tip_scrisoare: tipFormMedic,
        nume: cetatean.nume, prenume: cetatean.prenume, cnp: cetatean.cnp, domiciliu: domiciliu, telefon: cetatean.telefon, semnatura_base64: semnaturaBase64
      };

      if (tipFormMedic === 'familie') payload = { ...payload, ...formMedicFam };
      else payload = { ...payload, ...formMedicSpec };

      await api.post(`/dosare/${id}/scrisoare-medicala`, payload);
      toast.success('Documentul medical a fost generat și atașat!'); fetchDosar();
    } catch (e) { 
      // Acum vei vedea mesajul REAL de eroare venit de la backend, nu un "500 Server Error" generic!
      toast.error(e.response?.data?.eroare || 'Eroare la generarea scrisorii medicale'); 
    } finally { 
      setSavingStatus(false); 
    }
  };

  const finalizeazaAnchetaPrimarie = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați documentul!');
    
    setSavingStatus(true);
    try {
      const cetatean = dosar.cetatean;
      const domiciliu = `${cetatean.judet || ''}, ${cetatean.oras || ''}`;
      
      const payload = {
        nume: cetatean.nume, prenume: cetatean.prenume, cnp: cetatean.cnp, domiciliu, telefon: cetatean.telefon,
        ...formPrimarie, semnatura_base64: semnaturaBase64
      };

      await api.post(`/dosare/${id}/ancheta-sociala`, payload);
      toast.success('Ancheta socială a fost generată și atașată dosarului!'); fetchDosar();
    } catch (e) { 
      toast.error(e.response?.data?.eroare || 'Eroare la generarea anchetei sociale'); 
    } finally { 
      setSavingStatus(false); 
    }
  };

  const handleMergiLaProgramare = async () => {
    const docAtasate = dosar.Documents || dosar.documente || dosar.Documente || [];
    if (docAtasate.length === 0) return toast.warning('Nu există documente atașate la acest dosar!');
    const toateAprobate = docAtasate.every(doc => doc.validat === true || doc.validat === 1);
    if (!toateAprobate) return toast.warning('⚠️ Vă rugăm să verificați și să APROBAȚI TOATE documentele înainte de a efectua programarea!');
    navigate('/calendar', { state: { dosar_id: dosar.id, tip_dosar: dosar.tip } });
  };

  const Timeline = ({ status }) => {
    const all = ['depus', 'in_analiza', 'programat_comisie', 'aprobat'];
    const rejected = ['respins', 'incomplet', 'arhivat'].includes(status);
    const steps = rejected ? ['depus', 'in_analiza', status] : all;
    const idx = steps.indexOf(status);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 28 }}>
        {steps.map((s, i) => {
          const done = i < idx; const active = i === idx;
          return (
            <div key={s} style={{ position: 'relative', paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
              {i < steps.length - 1 && <div style={{ position: 'absolute', left: -21, top: 20, width: 2, height: '100%', background: done ? 'var(--blue)' : 'var(--border)' }} />}
              <div style={{ position: 'absolute', left: -28, top: 2, width: 16, height: 16, borderRadius: '50%', background: active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)', border: '2px solid white', boxShadow: '0 0 0 2px ' + (active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)') }} />
              <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : done ? 'var(--text-2)' : 'var(--text-3)' }}>{STATUS_LABEL[s]}</div>
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
  const esteFinalizat = ['programat_comisie', 'aprobat', 'respins'].includes(dosar.status);
  const docMedicCompletat = isMedic ? documenteAtasate.find(d => d.tip_document === 'certificat_medical' && d.utilizator_id === utilizator.id) : null;
  const docPrimarieCompletat = isFunctionarPrimarie ? documenteAtasate.find(d => d.tip_document === 'ancheta_sociala') : null;
  const documentGenerat = docMedicCompletat || docPrimarieCompletat;
  const esteFinalizatDeColaborator = !!documentGenerat;
  // Verificăm dacă data comisiei a trecut (folosind coloana corectă)
  const comisieTrecuta = programareExistenta && new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora) < new Date();
  
  const toateDocumenteleAprobate = documenteAtasate.length > 0 && documenteAtasate.every(doc => doc.validat === true || doc.validat === 1);

  return (
    <Layout title={`Dosar ${dosar.numar_dosar}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-2)' }}>
        <button onClick={() => navigate('/dosare')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)' }}>← Înapoi la dosare</button>
        <span>/</span><span style={{ fontFamily: 'DM Mono' }}>{dosar.numar_dosar}</span>
      </div>

      {isFunctionar ? (
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
                <h4 style={{ color: '#137333', margin: 0 }}>📅 Programare Comisie Fixată</h4>
                <p style={{ margin: '6px 0 0 0', fontSize: 13.5 }}>
                  Data: <strong>{new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora).toLocaleDateString('ro-RO')}</strong> · 
                  Ora: <strong>{new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora).toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'})}</strong>
                </p>
              </div>
            )}

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📁 Documente Încărcate</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              {documenteAtasate.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8, background: doc.tip_document === 'decizie' ? '#f0f9ff' : 'transparent' }}>
                  <div style={{ fontWeight: 500, color: doc.tip_document === 'decizie' ? 'var(--blue)' : 'inherit' }}>
                    {doc.tip_document === 'decizie' ? '📄 CERTIFICAT HANDICAP' : (doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document)}
                  </div>
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
                  <button 
                    className="btn" 
                    style={{ background: toateDocumenteleAprobate ? 'indigo' : '#9ca3af', color: '#fff', flex: 1, height: 40, fontWeight: 'bold' }} 
                    onClick={handleMergiLaProgramare}
                    disabled={savingStatus}
                  >
                    📅 Validare dosar și Programare la Comisie
                  </button>
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
                ✓ Dosarul a fost validat și programat la comisie! Se așteaptă data programării pentru a lua decizia finală.
              </div>
            ) : null}

            {/* SECȚIUNEA PENTRU DECIZIA FINALĂ A COMISIEI */}
            {dosar.status === 'programat_comisie' && comisieTrecuta && (
              <div style={{ marginTop: 30, padding: 20, border: '2px solid indigo', borderRadius: 8, background: '#f8f9fa' }}>
                <h3 style={{ color: 'indigo', marginBottom: 15 }}>⚖️ Decizie Finală Comisie</h3>
                <p style={{fontSize: 13, color: 'gray', marginBottom: 15}}>Data comisiei a trecut. Vă rugăm să introduceți decizia finală.</p>
                
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
                            <option value="usor">Ușor</option><option value="mediu">Mediu</option><option value="accentuat">Accentuat</option><option value="grav">Grav</option><option value="grav cu asistent personal">Grav cu asistent personal</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Termen de revizuire</label>
                          <select className="form-select" value={comisieDate.revizuire} onChange={e => setComisieDate({...comisieDate, revizuire: e.target.value})}>
                            <option value="3">3 Luni</option><option value="6">6 Luni</option><option value="12">12 Luni</option><option value="24">24 Luni</option><option value="nelimitat">Nelimitat (Permanent)</option>
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
                      <button className="btn btn-primary" onClick={handleFinalizareComisie} disabled={savingStatus}>
                         {savingStatus ? '⏳ Se procesează...' : 'Trimitere Decizie'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setComisieActiune('')}>Anulează</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Dacă a fost deja luată o decizie, o afișăm clar funcționarului */}
            {dosar.status === 'aprobat' && (
              <div style={{ marginTop: 20, padding: 16, background: '#e6f4ea', border: '1px solid #ceead6', borderRadius: 8 }}>
                <h4 style={{ color: '#137333', margin: '0 0 5px 0', fontSize: 15 }}>✅ Decizie: DOSAR APROBAT</h4>
                <p style={{ margin: 0, fontSize: 13.5, color: '#137333' }}>Certificatul a fost emis și trimis către cetățean.</p>
              </div>
            )}
            {dosar.status === 'respins' && (
               <div style={{ marginTop: 20, padding: 16, background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: 8 }}>
                 <h4 style={{ color: '#c5221f', margin: '0 0 5px 0', fontSize: 15 }}>❌ Decizie: DOSAR RESPINS</h4>
                 <p style={{ margin: 0, fontSize: 13.5, color: '#c5221f' }}><strong>Motiv:</strong> {dosar.motiv_respingere}</p>
               </div>
            )}
          </div>
        </div>

      ) : isMedic || isFunctionarPrimarie ? (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ fontSize: 14 }}>Cerere Cetățean: <strong style={{ color: 'var(--blue)' }}>{dosar.numar_dosar}</strong></div>
            <div>Status Solicitare: <span className={`badge badge-incomplet`}>⏳ În așteptare completare</span></div>
          </div>

          <div className="card" style={{ padding: 24, borderTop: '4px solid var(--blue)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date de Identificare</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 24, fontSize: 13.5 }}>
              <div>Nume complet: <strong>{cetatean.prenume} {cetatean.nume}</strong></div>
              <div>CNP: <strong>{cetatean.cnp || '—'}</strong></div>
              <div>Telefon: <strong>{cetatean.telefon || '—'}</strong></div>
              <div style={{ gridColumn: 'span 3' }}>Domiciliu: <strong>{cetatean.judet || ''}, {cetatean.oras || ''}</strong></div>
            </div>

            {/* ----- SECȚIUNE MEDIC ----- */}
            {isMedic && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button className={`btn ${tipFormMedic === 'familie' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTipFormMedic('familie')}>📝 Medic de Familie</button>
                  <button className={`btn ${tipFormMedic === 'specialist' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTipFormMedic('specialist')}>🩺 Medic Specialist</button>
                </div>

                {tipFormMedic === 'familie' ? (
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#1e293b' }}>Scrisoare Medicală (Medic de Familie)</h3>
                    <div className="form-group"><label>Anamneza</label><textarea className="form-textarea" rows="2" value={formMedicFam.anamneza} onChange={e => setFormMedicFam({...formMedicFam, anamneza: e.target.value})}></textarea></div>
                    <div className="form-group"><label>Diagnostic principal</label><input type="text" className="form-input" value={formMedicFam.diagnostic_principal} onChange={e => setFormMedicFam({...formMedicFam, diagnostic_principal: e.target.value})} /></div>
                    <div className="form-group"><label>Diagnostice secundare</label><textarea className="form-textarea" rows="2" value={formMedicFam.diagnostic_secundar} onChange={e => setFormMedicFam({...formMedicFam, diagnostic_secundar: e.target.value})}></textarea></div>
                    
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label>Internări în spital</label><button type="button" className="btn btn-sm btn-secondary" onClick={() => setFormMedicFam(f => ({...f, internari: [...f.internari, { data_inceput: '', data_sfarsit: '', unitate: '', diagnostic: '' }]}))}>+ Adaugă internare</button></div>
                      {formMedicFam.internari.map((int, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 2fr auto', gap: 8, marginTop: 10, padding: 10, background: '#fff', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <input type="date" className="form-input" value={int.data_inceput} onChange={e => { const u = [...formMedicFam.internari]; u[i].data_inceput = e.target.value; setFormMedicFam({...formMedicFam, internari: u}); }} />
                          <input type="date" className="form-input" value={int.data_sfarsit} onChange={e => { const u = [...formMedicFam.internari]; u[i].data_sfarsit = e.target.value; setFormMedicFam({...formMedicFam, internari: u}); }} />
                          <input type="text" className="form-input" placeholder="Spital" value={int.unitate} onChange={e => { const u = [...formMedicFam.internari]; u[i].unitate = e.target.value; setFormMedicFam({...formMedicFam, internari: u}); }} />
                          <input type="text" className="form-input" placeholder="Diagnostic ieșire" value={int.diagnostic} onChange={e => { const u = [...formMedicFam.internari]; u[i].diagnostic = e.target.value; setFormMedicFam({...formMedicFam, internari: u}); }} />
                          <button type="button" className="btn btn-sm text-danger" onClick={() => setFormMedicFam({...formMedicFam, internari: formMedicFam.internari.filter((_, idx) => idx !== i)})}>X</button>
                        </div>
                      ))}
                    </div>
                    <div className="form-group">
                      <label>Deplasabilitate</label>
                      <select className="form-select" value={formMedicFam.deplasabil} onChange={e => setFormMedicFam({...formMedicFam, deplasabil: e.target.value})}>
                        <option>Este deplasabilă (autonomă/cu sprijin)</option><option>Nu este deplasabilă (nici cu ajutor/scaun rulant)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#ecfdf5', padding: 20, borderRadius: 8, border: '1px solid #d1fae5' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#065f46' }}>Referat Medical (Medic Specialist)</h3>
                    <div className="form-group"><label>Diagnostic</label><textarea className="form-textarea" rows="2" value={formMedicSpec.diagnostic} onChange={e => setFormMedicSpec({...formMedicSpec, diagnostic: e.target.value})}></textarea></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                      <div className="form-group"><label>Evoluția bolii</label><select className="form-select" value={formMedicSpec.evolutie_boala} onChange={e => setFormMedicSpec({...formMedicSpec, evolutie_boala: e.target.value})}><option>Staționară</option><option>Ameliorare</option><option>Agravare</option><option>Vindecare</option></select></div>
                      <div className="form-group"><label>Pronostic de viață</label><select className="form-select" value={formMedicSpec.pronostic_viata} onChange={e => setFormMedicSpec({...formMedicSpec, pronostic_viata: e.target.value})}><option>Bun</option><option>Mediu</option><option>Rezervat</option></select></div>
                      <div className="form-group"><label>Pronostic de vindecare</label><select className="form-select" value={formMedicSpec.pronostic_vindecare} onChange={e => setFormMedicSpec({...formMedicSpec, pronostic_vindecare: e.target.value})}><option>Bun</option><option>Mediu</option><option>Rezervat</option></select></div>
                    </div>
                    <div className="form-group"><label>Tratamente urmate</label><textarea className="form-textarea" rows="2" value={formMedicSpec.tratamente_urmate} onChange={e => setFormMedicSpec({...formMedicSpec, tratamente_urmate: e.target.value})}></textarea></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                      <div className="form-group"><label>Răspuns la tratament</label><select className="form-select" value={formMedicSpec.raspuns_tratament} onChange={e => setFormMedicSpec({...formMedicSpec, raspuns_tratament: e.target.value})}><option>Bun</option><option>Mediu</option><option>Nesatisfăcător</option></select></div>
                      <div className="form-group"><label>Cooperare medic-pacient</label><select className="form-select" value={formMedicSpec.cooperare} onChange={e => setFormMedicSpec({...formMedicSpec, cooperare: e.target.value})}><option>Bună</option><option>Mediocră</option><option>Dificilă</option></select></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ----- SECȚIUNE PRIMĂRIE ----- */}
            {isFunctionarPrimarie && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)', borderTop: '1px solid var(--border)', paddingTop: 20 }}>🏡 Completare Anchetă Socială Oficială</h3>
                
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>I. Informații Generale</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                    <div className="form-group"><label>Ocupația</label><input type="text" className="form-input" value={formPrimarie.ocupatia} onChange={e => setPF('ocupatia', e.target.value)} /></div>
                    <div className="form-group"><label>Studii</label><select className="form-select" value={formPrimarie.studii} onChange={e => setPF('studii', e.target.value)}><option>Primare</option><option>Gimnaziale</option><option>Medii</option><option>Superioare</option></select></div>
                    <div className="form-group"><label>Stare civilă</label><select className="form-select" value={formPrimarie.stare_civila} onChange={e => setPF('stare_civila', e.target.value)}><option>Necăsătorit</option><option>Căsătorit</option><option>Văduv</option><option>Divorțat</option></select></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 15 }}>
                    <div className="form-group"><label>Are copii?</label><select className="form-select" value={formPrimarie.copii} onChange={e => setPF('copii', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    {formPrimarie.copii === 'Da' && <div className="form-group"><label>Detalii copii (nume, prenume, cnp, adresa)</label><input type="text" className="form-input" value={formPrimarie.detalii_copii} onChange={e => setPF('detalii_copii', e.target.value)} /></div>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 15 }}>
                    <div className="form-group"><label>Are Reprez. Legal?</label><select className="form-select" value={formPrimarie.reprezentant_legal} onChange={e => setPF('reprezentant_legal', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    {formPrimarie.reprezentant_legal === 'Da' && <div className="form-group"><label>Detalii reprezentant (nume, prenume, cnp, adresa)</label><input type="text" className="form-input" value={formPrimarie.detalii_reprezentant} onChange={e => setPF('detalii_reprezentant', e.target.value)} /></div>}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>II. Evaluarea gradului de autonomie (Alegeți gradul de ajutor necesar)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                    {['Igienă corporală', 'Îmbrăcat/Dezbrăcat', 'Servire și hrănire', 'Mobilizare', 'Deplasare în interior', 'Deplasare în exterior', 'Utilizare mijloace comunicare', 'Prepararea hranei', 'Activități gospodărești', 'Gestionare venituri', 'Cumpărături', 'Administrare tratament', 'Utilizare transport', 'Timp liber'].map((label, i) => {
                      const keys = ['igiena_corporala', 'imbracat_dezbracat', 'servire_hranire', 'mobilizare', 'deplasare_interior', 'deplasare_exterior', 'comunicare_mijloace', 'preparare_hrana', 'activitati_gospodaresti', 'gestionare_venituri', 'cumparaturi', 'administrare_tratament', 'utilizare_transport', 'timp_liber'];
                      return (
                        <div key={i} className="form-group"><label>{label}</label><select className="form-select" value={formPrimarie[keys[i]]} onChange={e => setPF(keys[i], e.target.value)}><option>Fără ajutor</option><option>Cu ajutor parțial</option><option>Cu ajutor integral</option></select></div>
                      )
                    })}
                    <div className="form-group"><label>Dispozitive deplasare</label><select className="form-select" value={formPrimarie.dispozitive_deplasare} onChange={e => setPF('dispozitive_deplasare', e.target.value)}><option>Niciunul</option><option>Baston</option><option>Scaun rulant</option><option>Cadru</option><option>Susținut de altcineva</option></select></div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>III. Evaluare senzorială și cognitivă</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                    <div className="form-group"><label>Memorie pe termen mediu</label><select className="form-select" value={formPrimarie.memorie} onChange={e => setPF('memorie', e.target.value)}><option>Își aduce aminte total</option><option>Își aduce aminte parțial</option><option>Nu își aduce aminte</option></select></div>
                    <div className="form-group"><label>Acuitate vizuală</label><select className="form-select" value={formPrimarie.vaz} onChange={e => setPF('vaz', e.target.value)}><option>Completă cu ochelari</option><option>Completă fără ochelari</option><option>Acuitate medie</option><option>Orbire</option></select></div>
                    <div className="form-group"><label>Comunicare</label><select className="form-select" value={formPrimarie.comunicare} onChange={e => setPF('comunicare', e.target.value)}><option>Bună</option><option>Medie</option><option>Nu poate comunica</option></select></div>
                    <div className="form-group"><label>Orientare</label><select className="form-select" value={formPrimarie.orientare} onChange={e => setPF('orientare', e.target.value)}><option>Fără probleme</option><option>Nu se poate orienta</option></select></div>
                    <div className="form-group"><label>Comportament</label><select className="form-select" value={formPrimarie.comportament} onChange={e => setPF('comportament', e.target.value)}><option>Bun</option><option>Degradat</option></select></div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>IV. Locuință și Familie</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 15 }}>
                    <div className="form-group"><label>Locuință</label><select className="form-select" value={formPrimarie.tip_locuinta} onChange={e => setPF('tip_locuinta', e.target.value)}><option>Casă</option><option>Apartament</option></select></div>
                    <div className="form-group"><label>Nr. Camere</label><input type="number" className="form-input" value={formPrimarie.nr_camere} onChange={e => setPF('nr_camere', e.target.value)} /></div>
                    <div className="form-group"><label>Încălzire</label><select className="form-select" value={formPrimarie.incalzire} onChange={e => setPF('incalzire', e.target.value)}><option>Fără</option><option>Centrală</option><option>Sobă</option></select></div>
                    <div className="form-group"><label>Apă curentă</label><select className="form-select" value={formPrimarie.apa_curenta} onChange={e => setPF('apa_curenta', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                  </div>
                  <div className="form-group"><label>Alte dotări ale locuinței</label><input type="text" className="form-input" value={formPrimarie.dotari_locuinta} onChange={e => setPF('dotari_locuinta', e.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                    <div className="form-group"><label>Trăiește</label><select className="form-select" value={formPrimarie.coabitare} onChange={e => setPF('coabitare', e.target.value)}><option>Singur</option><option>Cu familia</option></select></div>
                    <div className="form-group"><label>Coabitant bolnav?</label><select className="form-select" value={formPrimarie.coabitant_bolnav} onChange={e => setPF('coabitant_bolnav', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    <div className="form-group"><label>Coabitant cu adicții?</label><select className="form-select" value={formPrimarie.coabitant_adictii} onChange={e => setPF('coabitant_adictii', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    <div className="form-group"><label>Relația cu familia</label><select className="form-select" value={formPrimarie.relatie_familie} onChange={e => setPF('relatie_familie', e.target.value)}><option>Bună</option><option>Cu probleme</option></select></div>
                    <div className="form-group"><label>Risc neglijare?</label><select className="form-select" value={formPrimarie.risc_neglijare} onChange={e => setPF('risc_neglijare', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    <div className="form-group"><label>Risc abuz?</label><select className="form-select" value={formPrimarie.risc_abuz} onChange={e => setPF('risc_abuz', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                  </div>
                  <div className="form-group"><label>Persoană de contact urgență (nume, cnp, tel, rudenie)</label><input type="text" className="form-input" value={formPrimarie.pers_contact} onChange={e => setPF('pers_contact', e.target.value)} /></div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>V. Concluzii</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15, marginBottom: 15 }}>
                    <div className="form-group"><label>Are prieteni?</label><select className="form-select" value={formPrimarie.are_prieteni} onChange={e => setPF('are_prieteni', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                    <div className="form-group"><label>Relațiile de prietenie</label><select className="form-select" value={formPrimarie.relatii_prietenie} onChange={e => setPF('relatii_prietenie', e.target.value)}><option>Permanente</option><option>Ocazionale</option></select></div>
                    <div className="form-group"><label>Participă în comunitate?</label><select className="form-select" value={formPrimarie.participare_comunitate} onChange={e => setPF('participare_comunitate', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                  </div>
                  <div className="form-group"><label>Concluzii generale / Recomandări finale</label><textarea className="form-textarea" rows="3" value={formPrimarie.concluzii} onChange={e => setPF('concluzii', e.target.value)}></textarea></div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Semnătura ({isMedic ? 'Medicului' : 'Funcționarului'})</label>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 8, width: 400, background: '#fff', marginTop: 6 }}><canvas ref={canvasRef} width={400} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} style={{ cursor: 'crosshair' }} /></div>
              <button type="button" onClick={curataSemnatura} className="text-link" style={{ marginTop: 5, background: 'none', border: 'none', fontSize: 12 }}>Curăță semnătura</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20, textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={isMedic ? finalizeazaScrisoare : finalizeazaAnchetaPrimarie} disabled={savingStatus}>
                {savingStatus ? 'Se generează...' : `✓ Finalizare și Generare PDF`}
              </button>
            </div>
          </div>
        </div>

      ) : (
        /* ── LAYOUT STANDARD CETĂȚEAN / ADMIN / MANAGER ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* BANNERE DE DECIZIE PENTRU CETĂȚEAN */}
            {dosar.status === 'aprobat' && (
              <div style={{ padding: 20, background: '#e6f4ea', border: '2px solid #34a853', borderRadius: 8 }}>
                <h3 style={{ color: '#137333', margin: '0 0 10px 0', fontSize: 16 }}>✅ DOSAR APROBAT</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#137333', lineHeight: 1.5 }}>
                  Certificatul dumneavoastră a fost emis cu succes de către comisia de specialitate.<br/>
                  Îl puteți descărca regăsindu-l mai jos în secțiunea <strong>"Documente atașate"</strong>.
                </p>
              </div>
            )}
            
            {dosar.status === 'respins' && (
              <div style={{ padding: 20, background: '#fce8e6', border: '2px solid #ea4335', borderRadius: 8 }}>
                <h3 style={{ color: '#c5221f', margin: '0 0 10px 0', fontSize: 16 }}>❌ DOSAR RESPINS</h3>
                <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#c5221f' }}>
                  Ne pare rău, dar dosarul dumneavoastră a fost respins de către comisie.
                </p>
                <div style={{ background: '#fff', padding: 15, borderRadius: 6, border: '1px solid #fad2cf' }}>
                   <span style={{ fontSize: 12, color: '#c5221f', fontWeight: 'bold' }}>MOTIVUL RESPINGERII:</span>
                   <p style={{ margin: '5px 0 0 0', fontSize: 13.5, color: '#333' }}>{dosar.motiv_respingere || 'Nu a fost specificat un motiv detaliat.'}</p>
                </div>
              </div>
            )}

            {programareExistenta && isCetatean && !['aprobat', 'respins'].includes(dosar.status) && (
              <div className="card" style={{ border: '2px solid var(--blue)', background: '#f8fafc', padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--blue)' }}>📅 Ai o Programare Activă la Comisie</h3>
                <div style={{ padding: 12, background: '#e6f4ea', color: '#137333', borderRadius: 6, fontWeight: 500 }}>
                  ✓ Ești programat cu succes în data de: {new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora).toLocaleDateString('ro-RO')} la ora {new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora).toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'})}.<br/><br/>
                  📍 Locația: {programareExistenta.locatie}
                </div>
              </div>
            )}

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
                {canEditStatus && <button className="btn btn-secondary btn-sm" onClick={() => setEditStatus(!editStatus)}>Modifică status</button>}
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
                  {!['aprobat', 'respins'].includes(dosar.status) && (
                    <>
                      <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={uploadDocument} />
                      <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>+ Adaugă</button>
                    </>
                  )}
                </div>
              </div>
              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item" style={{ alignItems: 'center', background: doc.tip_document === 'decizie' ? '#f0f9ff' : 'transparent', border: doc.tip_document === 'decizie' ? '1px solid #bae6fd' : '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontWeight: doc.tip_document === 'decizie' ? 'bold' : 'normal', color: doc.tip_document === 'decizie' ? 'var(--blue)' : 'inherit' }}>
                      {doc.tip_document === 'decizie' ? '📄 CERTIFICAT HANDICAP' : (doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document)}
                    </div>
                    {doc.cale_fisier && <a href={`http://localhost:5000/${doc.cale_fisier.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Deschide PDF</a>}
                  </div>
                ))}
              </div>
            </div>
          </div>

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