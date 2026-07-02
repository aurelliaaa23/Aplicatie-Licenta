import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = [
  { value: 'in_analiza',               label: '🔍 În analiză' },
  { value: 'incomplet',                label: '⚠️ Incomplet / necesită completări' },
  { value: 'programat_comisie',        label: '📅 Programat la comisie' },
  { value: 'aprobat',                  label: '✅ Decizie finală (Aprobat)' },
  { value: 'respins',                  label: '❌ Respins' },
  { value: 'arhivat',                  label: '🗄️ Arhivat' },
];

const STATUS_LABEL = {
  depus: 'Depus', in_analiza: 'În analiză', incomplet: 'Incomplet',
  in_asteptare_programare: 'În așteptare programare',
  programat_comisie: 'Programat comisie', aprobat: 'Decizie finală',
  respins: 'Respins', arhivat: 'Arhivat',
};

const TIP_LABEL = {
  certificat_handicap: 'Certificat handicap', adoptie: 'Adopție',
  plasament: 'Plasament familial', alocatie: 'Alocație de stat',
  indemnizatie: 'Indemnizație creștere copil', evaluare_adulti: 'Evaluare adulți', alte_servicii: 'Alte servicii',
};

const DOC_TIP_LABEL = {
  carte_identitate: 'Carte identitate', certificat_medical: 'Certificat medical',
  ancheta_sociala: 'Anchetă socială', referat: 'Referat', adeverinta_scolara: 'Adeverință școlară',
  decizie: 'Decizie (Certificat)', semnatura: 'Semnătură electronică', alte: 'Alt document',
  ci_parinti: 'Carte Identitate Părinți', cert_nastere: 'Certificat Naștere Copil',
  extras_cont: 'Extras de Cont', cert_casatorie: 'Certificat Căsătorie / Divorț',
  adev_munca: 'Adeverință Angajator'
};

const SuccessBox = ({ mesaj }) => (
  <div style={{ padding: '30px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, textAlign: 'center', marginBottom: 15 }}>
    <div style={{ fontSize: 48, marginBottom: 15 }}>✅</div>
    <h3 style={{ fontSize: 18, color: '#166534', marginBottom: 10 }}>Document Finalizat</h3>
    <p style={{ color: '#15803d', fontSize: 14 }}>{mesaj}</p>
  </div>
);

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
  const isReprezentant = rol === 'reprezentant_școală';
  const isPolitie = rol === 'funcționar_poliție';

  const deptUser = (utilizator?.profilFunctionar?.departament || utilizator?.departament || '').toLowerCase();
  const isEvidenta = deptUser.includes('evidenț') || deptUser.includes('evident') || deptUser.includes('persoane');
  const isAsistenta = deptUser.includes('asistenț') || deptUser.includes('asistent') || (!isEvidenta && isFunctionarPrimarie);

  const [showDocsBox, setShowDocsBox] = useState(false);
  const [docsSuplimentare, setDocsSuplimentare] = useState('');
  const [comisieActiune, setComisieActiune] = useState('');
  const [comisieDate, setComisieDate] = useState({ grad: 'mediu', revizuire: '12', motiv: '' });
  const [actiuneCopilActiva, setActiuneCopilActiva] = useState(false);

  const canvasRef = useRef(null);
  const docsBoxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- STATE-URI FORMULARE ---
  const [tipFormMedic, setTipFormMedic] = useState('familie');
  const [formMedicFam, setFormMedicFam] = useState({ anamneza: '', diagnostic_principal: '', diagnostic_secundar: '', internari: [], deplasabil: 'Este deplasabil(ă) (autonom /cu sprijin)' });
  const [formMedicSpec, setFormMedicSpec] = useState({ diagnostic: '', evolutie_boala: 'Staționară', pronostic_viata: 'Bun', pronostic_vindecare: 'Bun', tratamente_urmate: '', raspuns_tratament: 'Bun', cooperare: 'Bună' });
  const [formScoala, setFormScoala] = useState({ nume_copil: '', prenume_copil: '', cnp_copil: '', clasa: '', media: '', nr_absente: '' });
  const [formPrimarie, setFormPrimarie] = useState({
    ocupatia: '', studii: 'Medii', stare_civila: 'Necăsătorit', copii: 'Nu', detalii_copii: '',
    reprezentant_legal: 'Nu', detalii_reprezentant: '',
    igiena_corporala: 'Fără ajutor', imbracat_dezbracat: 'Fără ajutor', servire_hranire: 'Fără ajutor',
    mobilizare: 'Fără ajutor', deplasare_interior: 'Fără ajutor', deplasare_exterior: 'Fără ajutor',
    comunicare_mijloace: 'Fără ajutor', dispozitive_deplasare: 'Niciunul', preparare_hrana: 'Fără ajutor',
    activitati_gospodaresti: 'Fără ajutor', gestionare_venituri: 'Fără ajutor', cumparaturi: 'Fără ajutor',
    administrare_tratament: 'Fără ajutor', utilizare_transport: 'Fără ajutor', sport: 'Fără ajutor',
    timp_liber: 'Fără ajutor', memorie: 'Își aduce aminte total', vaz: 'Complet fără ochelari',
    comunicare: 'Bună', orientare: 'Fără probleme', comportament: 'Bun',
    tip_locuinta: 'Casă', nr_camere: '2', incalzire: 'Centrală', apa_curenta: 'Da', dotari_locuinta: '',
    coabitare: 'Cu familia', coabitant_bolnav: 'Nu', coabitant_adictii: 'Nu', relatie_familie: 'Bună',
    risc_neglijare: 'Nu', risc_abuz: 'Nu', pers_contact: '', are_prieteni: 'Da',
    relatii_prietenie: 'Permanente', participare_comunitate: 'Da', concluzii: ''
  });
  const setPF = (k, v) => setFormPrimarie(prev => ({ ...prev, [k]: v }));

  const [formCazier, setFormCazier] = useState({ antecedente: 'Nu are antecedente penale', mentiuni: '' });
  const [formDomiciliu, setFormDomiciliu] = useState({ confirmare: 'Da, locuiește la adresa declarată', detalii: '' });
  const [formAnchetaAdoptie, setFormAnchetaAdoptie] = useState({ locuinte: '', venituri: '', istoric: '', motivatie: '', concluzie: 'Apt pentru adopție' });

  // Stocăm datele medicului pentru fiecare solicitare separată
  const [formMedicAdoptie, setFormMedicAdoptie] = useState({});
  const setFormMedic = (solId, key, val) => {
    setFormMedicAdoptie(prev => ({ ...prev, [solId]: { ...(prev[solId] || { boli: 'Fără boli cronice', istoric: 'Fără istoric relevant', apt: 'ESTE' }), [key]: val } }));
  };

  useEffect(() => { fetchDosar(); }, [id]);

  const fetchDosar = async () => {
    try {
      const { data } = await api.get(`/dosare/${id}`);
      setDosar(data);
      setNewStatus(data.status);
      setMotiv(data.motiv_respingere || '');

      if (data.descriere && data.descriere.includes('[Date Copil:')) {
        const match = data.descriere.match(/\[Date Copil: (.*?), CNP: (.*?)\]/);
        if (match) {
          const numeCompletArr = match[1].split(' ');
          setFormScoala(prev => ({ ...prev, nume_copil: numeCompletArr[0] || '', prenume_copil: numeCompletArr.slice(1).join(' ') || '', cnp_copil: match[2] || '' }));
        }
      }
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
      setShowDocsBox(false); setDocsSuplimentare(''); fetchDosar();
    } catch { toast.error('Eroare la actualizarea statusului'); } finally { setSavingStatus(false); }
  };

  const handleAprobaDocument = async (docId) => {
    try {
      await api.patch(`/documente/${docId}/valideaza`);
      setDosar(prev => ({ ...prev, Documents: prev.Documents.map(d => d.id === docId ? { ...d, validat: true } : d) }));
      toast.success('Document aprobat!');
    } catch { toast.error('Eroare la aprobare'); }
  };

  const handleFinalizareComisie = async () => {
    if (comisieActiune === 'respinge' && !comisieDate.motiv) return toast.warning('Introduceți motivul!');
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/finalizare-comisie`, { actiune: comisieActiune, grad: comisieDate.grad, revizuire_luni: comisieDate.revizuire, motiv: comisieDate.motiv });
      toast.success(comisieActiune === 'aproba' ? 'Certificat emis cu succes!' : 'Dosar respins!');
      setComisieActiune(''); fetchDosar();
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
    if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };

  // ── GENERATOARE PDF COLABORATORI EXTERNI ──
  const finalizeazaAdeverintaScoala = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați documentul!');
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/adeverinta-scolara`, { ...formScoala, semnatura_base64: semnaturaBase64 });
      toast.success('Adeverința a fost generată și atașată la dosar!'); fetchDosar();
    } catch (e) { toast.error(e.response?.data?.eroare || 'Eroare la generarea adeverinței'); }
    finally { setSavingStatus(false); }
  };

  const finalizeazaScrisoare = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați documentul!');
    setSavingStatus(true);
    try {
      const cetatean = dosar.cetatean;
      const domiciliu = `${cetatean.judet || ''}, ${cetatean.oras || ''}`;
      let payload = { tip_scrisoare: tipFormMedic, nume: cetatean.nume, prenume: cetatean.prenume, cnp: cetatean.cnp, domiciliu: domiciliu, telefon: cetatean.telefon, semnatura_base64: semnaturaBase64 };
      if (tipFormMedic === 'familie') payload = { ...payload, ...formMedicFam }; else payload = { ...payload, ...formMedicSpec };
      await api.post(`/dosare/${id}/scrisoare-medicala`, payload);
      toast.success('Documentul medical a fost generat și atașat!'); fetchDosar();
    } catch (e) { toast.error(e.response?.data?.eroare || 'Eroare la generarea scrisorii medicale'); }
    finally { setSavingStatus(false); }
  };

  const finalizeazaAnchetaPrimarie = async () => {
    const semnaturaBase64 = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (semnaturaBase64 === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați documentul!');
    setSavingStatus(true);
    try {
      const cetatean = dosar.cetatean;
      const domiciliu = `${cetatean.judet || ''}, ${cetatean.oras || ''}`;
      const payload = { nume: cetatean.nume, prenume: cetatean.prenume, cnp: cetatean.cnp, domiciliu, telefon: cetatean.telefon, ...formPrimarie, semnatura_base64: semnaturaBase64 };
      await api.post(`/dosare/${id}/ancheta-sociala`, payload);
      toast.success('Ancheta socială a fost generată și atașată dosarului!'); fetchDosar();
    } catch (e) { toast.error(e.response?.data?.eroare || 'Eroare la generarea anchetei sociale'); }
    finally { setSavingStatus(false); }
  };

  const handleGenerareAdoptie = async (tipFormular, dateFormular, solicitareId = null) => {
    const sig = canvasRef.current.toDataURL('image/png');
    const blankCanvas = document.createElement('canvas'); blankCanvas.width = canvasRef.current.width; blankCanvas.height = canvasRef.current.height;
    if (sig === blankCanvas.toDataURL()) return toast.error('Vă rugăm să semnați în căsuța de jos înainte de a genera!');
    setSavingStatus(true);
    try {
      await api.post(`/dosare/${id}/document-adoptie`, { tip_formular: tipFormular, date_formular: dateFormular, semnatura_base64: sig, solicitare_id: solicitareId });
      toast.success('Document generat și atașat cu succes!');
      curataSemnatura(); fetchDosar();
    } catch { toast.error('Eroare la generare formular adopție'); }
    finally { setSavingStatus(false); }
  };

  const handleMergiLaProgramare = async () => {
    const docAtasate = dosar.Documents || dosar.documente || dosar.Documente || [];
    if (docAtasate.length === 0) return toast.warning('Nu există documente atașate la acest dosar!');
    const toateAprobate = docAtasate.every(doc => doc.validat === true || doc.validat === 1);
    if (!toateAprobate) return toast.warning('Vă rugăm să verificați și să APROBAȚI TOATE documentele înainte de a efectua programarea!');
    navigate('/calendar', { state: { dosar_id: dosar.id, tip_dosar: dosar.tip } });
  };

  const isCopilDosar = dosar?.tip === 'alocatie' || dosar?.tip === 'indemnizatie';
  const isAdoptie = dosar?.tip === 'adoptie';

  const Timeline = ({ status }) => {
    const all = ['depus', 'in_analiza', 'programat_comisie', 'aprobat'];
    const rejected = ['respins', 'incomplet', 'arhivat'].includes(status);
    const stepsBase = isCopilDosar ? ['depus', 'in_analiza', 'aprobat'] : all;
    const steps = rejected ? ['depus', 'in_analiza', status] : stepsBase;
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
  const comisieTrecuta = programareExistenta && new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora) < new Date();

  const esteFinalizat = ['programat_comisie', 'aprobat', 'respins'].includes(dosar.status);
  const toateDocumenteleAprobate = documenteAtasate.length > 0 && documenteAtasate.every(doc => doc.validat === true || doc.validat === 1);

  // Extragem informațiile Partenerului / Copilului
  let copilInfo = null;
  if (dosar?.descriere && dosar.descriere.includes('[Date Copil:')) {
    const match = dosar.descriere.match(/\[Date Copil: (.*?), CNP: (.*?)\]/);
    if (match) copilInfo = { numeComplet: match[1], cnp: match[2] };
  }

  let partenerInfo = null;
  if (dosar?.descriere && dosar.descriere.includes('[Partener:')) {
    const match = dosar.descriere.match(/\[Partener: (.*?), CNP: (.*?)\]/);
    if (match) partenerInfo = { numeComplet: match[1], cnp: match[2] };
  }

  let descriereCurata = dosar?.descriere || 'Nicio descriere furnizată.';
  descriereCurata = descriereCurata.replace(/\[Date Copil:.*?\]\n\n?/g, '');
  descriereCurata = descriereCurata.replace(/\[Partener:.*?\]\n\n?/g, '');

  // Verificări Externe (Ce formulare s-au completat)
  const areCazier = documenteAtasate.some(d => d.nume_fisier && d.nume_fisier.includes('Cazier'));
  const areDomiciliu = documenteAtasate.some(d => d.nume_fisier && d.nume_fisier.includes('Domiciliu'));
  const areAnchetaAdoptie = documenteAtasate.some(d => d.tip_document === 'ancheta_sociala');

  const solicitariMedic = (dosar.solicitari || []).filter(s => s.medic_id === utilizator.id);
  const medicSolsComplete = solicitariMedic.length > 0 && solicitariMedic.every(s => s.status === 'finalizata' || s.status === 'finalizat');

  const ascundeFormularulStandard = !isAdoptie && ((isMedic || isReprezentant) ? medicSolsComplete : !!documenteAtasate.find(d => d.tip_document === 'ancheta_sociala'));

  // Calculez starea pt Badges/Text sus
  let topStatusText = 'În așteptare completare';
  let topStatusBadge = 'incomplet';

  if (isMedic && isAdoptie) {
    if (medicSolsComplete) { topStatusText = '✓ Completat'; topStatusBadge = 'aprobat'; }
    else if (solicitariMedic.some(s => s.status === 'finalizata' || s.status === 'finalizat')) { topStatusText = 'Parțial completat'; }
  } else if (isPolitie && isAdoptie && areCazier) {
    topStatusText = '✓ Completat'; topStatusBadge = 'aprobat';
  } else if (isFunctionarPrimarie && isAdoptie) {
    if (isEvidenta && areDomiciliu) { topStatusText = '✓ Completat'; topStatusBadge = 'aprobat'; }
    else if (isAsistenta && areAnchetaAdoptie) { topStatusText = '✓ Completat'; topStatusBadge = 'aprobat'; }
  } else if (ascundeFormularulStandard) {
    topStatusText = '✓ Completat'; topStatusBadge = 'aprobat';
  }

  const arataSignaturePad =
    (isPolitie && isAdoptie && !areCazier) ||
    (isFunctionarPrimarie && isAdoptie && ((isEvidenta && !areDomiciliu) || (isAsistenta && !areAnchetaAdoptie))) ||
    (isFunctionarPrimarie && !isAdoptie && !ascundeFormularulStandard) ||
    (isMedic && isAdoptie && solicitariMedic.some(s => s.status !== 'finalizata' && s.status !== 'finalizat')) ||
    ((isMedic || isReprezentant) && !isAdoptie && !ascundeFormularulStandard);

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
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Titular (Părinte)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 24 }}>
              <div>Nume complet: <strong>{cetatean.prenume} {cetatean.nume}</strong></div>
              <div>CNP: <strong>{cetatean.cnp || '—'}</strong></div>
              <div>Telefon: <strong>{cetatean.telefon || '—'}</strong></div>
              <div>E-mail: <strong>{cetatean.email || '—'}</strong></div>
              <div>Județ / Localitate: <strong>{cetatean.judet || '—'}, {cetatean.oras || '—'}</strong></div>
              {cetatean.profilCetatean?.adresa_completa && (
                <div>Stradă / Nr.: <strong>{cetatean.profilCetatean.adresa_completa}</strong></div>
              )}
            </div>

            {partenerInfo && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Soț/Soție (Partener)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 24 }}>
                  <div>Nume complet partener: <strong>{partenerInfo.numeComplet}</strong></div>
                  <div>CNP Partener: <strong>{partenerInfo.cnp}</strong></div>
                </div>
              </>
            )}

            {copilInfo && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👦 Date Copil (Beneficiar)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 24 }}>
                  <div>Nume complet copil: <strong>{copilInfo.numeComplet}</strong></div>
                  <div>CNP Copil: <strong>{copilInfo.cnp}</strong></div>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title">Documente atașate</div>
                {canEditStatus && <button className="btn btn-secondary btn-sm" onClick={() => setEditStatus(!editStatus)}>Modifică status</button>}
              </div>

              {editStatus && canEditStatus && (
                <div style={{ marginTop: 16, padding: 16, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 16 }}>
                  <div className="form-group"><label>Noul status</label><select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                  {newStatus === 'respins' && <div className="form-group"><label>Motiv respingere</label><textarea className="form-textarea" value={motiv} onChange={e => setMotiv(e.target.value)} /></div>}
                  <button className="btn btn-primary" onClick={saveStatus} disabled={savingStatus}>Aplica</button>
                </div>
              )}

              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item" style={{ alignItems: 'center', background: doc.tip_document === 'decizie' ? '#f0f9ff' : 'transparent', border: doc.tip_document === 'decizie' ? '1px solid #bae6fd' : '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontWeight: doc.tip_document === 'decizie' ? 'bold' : 'normal', color: doc.tip_document === 'decizie' ? 'var(--blue)' : 'inherit' }}>
                      {doc.tip_document === 'decizie' ? '🏆 ' : '📄 '}
                      {doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {doc.validat ? <span className="badge badge-aprobat">✓ Aprobat</span> : <span className="badge badge-incomplet">⏳ Neaprobat</span>}
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}/${doc.cale_fisier}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">👁 Vezi</a>
                      {!doc.validat && isFunctionar && <button className="btn btn-sm btn-primary" onClick={() => handleAprobaDocument(doc.id)}>✓ Aprobă</button>}
                      {!doc.validat && isFunctionar && <button 
  className="btn btn-sm" 
  style={{ background: '#fce8e6', color: '#c5221f', border: 'none', padding: '5px 10px', fontSize: 12 }} 
  onClick={() => { 
    setDocsSuplimentare(prev => prev 
      ? `${prev}\n- Retrimitere: ${doc.nume_fisier || doc.tip_document}` 
      : `- Retrimitere: ${doc.nume_fisier || doc.tip_document}`
    ); 
    setShowDocsBox(true);
    setTimeout(() => docsBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }}
>
  ✖ Cere retrimitere
</button>}
                    </div>
                  </div>
                ))}
              </div>

              {!esteFinalizat ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
    <div style={{ display: 'flex', gap: 12 }}>
      <button className="btn btn-secondary" onClick={() => setShowDocsBox(!showDocsBox)} style={{ flex: 1, height: 40 }}>
        💬 Cere documente suplimentare
      </button>
      {(isCopilDosar || isAdoptie) ? (
        <button className="btn" style={{ background: toateDocumenteleAprobate ? '#10b981' : '#9ca3af', color: '#fff', flex: 1, height: 40, fontWeight: 'bold' }} onClick={() => setActiuneCopilActiva(true)} disabled={savingStatus || !toateDocumenteleAprobate}>
          ✔️ Validare și Decizie Finală
        </button>
      ) : (
        <button className="btn" style={{ background: toateDocumenteleAprobate ? 'indigo' : '#9ca3af', color: '#fff', flex: 1, height: 40, fontWeight: 'bold' }} onClick={handleMergiLaProgramare} disabled={savingStatus}>
          📅 Validare dosar și Programare la Comisie
        </button>
      )}
    </div>

    {/* ── CĂSUȚA RETRIMITERE / DOCUMENTE SUPLIMENTARE ── */}
    {showDocsBox && (
  <div 
    ref={docsBoxRef}
    style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}
  >
    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
      📋 Specificați documentele necesare (vor fi trimise cetățeanului pe email):
    </label>
    <textarea
      className="form-textarea"
      rows="4"
      value={docsSuplimentare}
      onChange={(e) => setDocsSuplimentare(e.target.value)}
      placeholder="Ex: Vă rugăm să retrimiteți actul de identitate în format clar și lizibil..."
      autoFocus
    />
    <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => { setShowDocsBox(false); setDocsSuplimentare(''); }}>
        Anulează
      </button>
      <button 
        className="btn btn-primary btn-sm" 
        onClick={() => handleActionFunctionar('incomplet', docsSuplimentare)} 
        disabled={savingStatus || !docsSuplimentare.trim()}
      >
        ✉️ Trimite solicitarea pe Email
      </button>
    </div>
  </div>
)}

    {(isCopilDosar || isAdoptie) && actiuneCopilActiva && (
      <div style={{ padding: 20, background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 8, marginTop: 16 }}>
        <h4 style={{ color: '#166534', margin: '0 0 15px 0', fontSize: 16 }}>🎯 Luare Decizie Finală</h4>
        <p style={{ fontSize: 13.5, color: '#15803d', marginBottom: 16 }}>
          Pentru dosarele de {TIP_LABEL[dosar.tip]}, decizia vă aparține direct, fără programare la comisie.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => handleActionFunctionar('aprobat')} disabled={savingStatus}>✅ Aprobă și Acordă</button>
          <button className="btn btn-danger" onClick={() => { const m = window.prompt('Introduceți motivul respingerii:'); if (m) handleActionFunctionar('respins'); }} disabled={savingStatus}>❌ Respinge Dosar</button>
          <button className="btn btn-secondary" onClick={() => setActiuneCopilActiva(false)}>Anulează</button>
        </div>
      </div>
    )}
  </div>
) : dosar.status === 'programat_comisie' && !comisieTrecuta ? (
  <div style={{ padding: 16, background: '#e6f4ea', color: '#137333', textAlign: 'center', borderRadius: 8, fontWeight: 600 }}>
    ⏳ Dosarul a fost validat și programat la comisie! Se așteaptă data programării.
  </div>
) : null}
            </div>

            {dosar.status === 'programat_comisie' && comisieTrecuta && !isCopilDosar && !isAdoptie && (
              <div style={{ marginTop: 30, padding: 20, border: '2px solid indigo', borderRadius: 8, background: '#f8f9fa' }}>
                <h3 style={{ color: 'indigo', marginBottom: 15 }}>⚖️ Decizie Finală Comisie</h3>
                <p style={{ fontSize: 13, color: 'gray', marginBottom: 15 }}>Data comisiei a trecut. Vă rugăm introduceți decizia finală.</p>
                {!comisieActiune ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={() => setComisieActiune('aproba')}>✅ Aprobă și Emite Certificat</button>
                    <button className="btn btn-danger" onClick={() => setComisieActiune('respinge')}>❌ Respinge dosarul</button>
                  </div>
                ) : (
                  <div>
                    {comisieActiune === 'aproba' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group"><label>Grad handicap</label><select className="form-select" value={comisieDate.grad} onChange={e => setComisieDate({ ...comisieDate, grad: e.target.value })}><option value="usor">Ușor</option><option value="mediu">Mediu</option><option value="accentuat">Accentuat</option><option value="grav">Grav</option></select></div>
                        <div className="form-group"><label>Revizuire (luni)</label><select className="form-select" value={comisieDate.revizuire} onChange={e => setComisieDate({ ...comisieDate, revizuire: e.target.value })}><option value="6">6 luni</option><option value="12">12 luni</option><option value="24">24 luni</option><option value="permanent">Permanent</option></select></div>
                      </div>
                    )}
                    {comisieActiune === 'respinge' && (
                      <div className="form-group"><label>Motiv respingere *</label><textarea className="form-textarea" value={comisieDate.motiv} onChange={e => setComisieDate({ ...comisieDate, motiv: e.target.value })} /></div>
                    )}
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn btn-primary" onClick={handleFinalizareComisie} disabled={savingStatus}>Confirmă decizia</button>
                      <button className="btn btn-secondary" onClick={() => setComisieActiune('')}>Anulează</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (isMedic || isReprezentant || isFunctionarPrimarie || isPolitie) ? (

        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ fontSize: 14 }}>Cerere Cetățean: <strong style={{ color: 'var(--blue)' }}>{dosar.numar_dosar}</strong></div>
            <div>
              Status Solicitare: <span className={`badge badge-${topStatusBadge}`} style={{ marginLeft: 8 }}>{topStatusText}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 24, borderTop: '4px solid var(--blue)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Titular</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, padding: 16, background: 'var(--bg)', borderRadius: 8, marginBottom: 24, fontSize: 13.5 }}>
              <div>Nume complet: <strong>{cetatean.prenume} {cetatean.nume}</strong></div>
              <div>CNP: <strong>{cetatean.cnp || '—'}</strong></div>
              <div>Telefon: <strong>{cetatean.telefon || '—'}</strong></div>
              <div>Județ: <strong>{cetatean.judet || '—'}</strong></div>
              <div>Localitate: <strong>{cetatean.oras || '—'}</strong></div>
              {cetatean.profilCetatean?.adresa_completa && (
                <div>Stradă / Nr.: <strong>{cetatean.profilCetatean.adresa_completa}</strong></div>
              )}
            </div>

            {partenerInfo && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👤 Date Soț/Soție (Partener)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 24, fontSize: 13.5 }}>
                  <div>Nume complet partener: <strong>{partenerInfo.numeComplet}</strong></div>
                  <div>CNP Partener: <strong>{partenerInfo.cnp}</strong></div>
                </div>
              </>
            )}

            {copilInfo && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👦 Date Elev / Copil</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 24, fontSize: 13.5 }}>
                  <div>Nume complet copil: <strong>{copilInfo.numeComplet}</strong></div>
                  <div>CNP Copil: <strong>{copilInfo.cnp}</strong></div>
                </div>
              </>
            )}

            {/* ----- SECȚIUNE POLIȚIE (DOAR ADOPȚIE) ----- */}
            {isPolitie && isAdoptie && (
              areCazier ? <SuccessBox mesaj="Cazierul judiciar a fost generat și atașat la dosar cu succes." /> : (
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#1e293b' }}>👮 Emitere Cazier Judiciar</h3>
                  <div className="form-group">
                    <label>Antecedente penale</label>
                    <select className="form-select" value={formCazier.antecedente} onChange={e => setFormCazier({ ...formCazier, antecedente: e.target.value })}>
                      <option>Nu are antecedente penale</option><option>Are antecedente penale</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Mențiuni suplimentare</label>
                    <textarea className="form-textarea" placeholder="Mențiuni..." value={formCazier.mentiuni} onChange={e => setFormCazier({ ...formCazier, mentiuni: e.target.value })} />
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={() => handleGenerareAdoptie('cazier', { ANTECEDENTE: formCazier.antecedente, MENTIUNI_CAZIER: formCazier.mentiuni })} disabled={savingStatus}>🖨️ Generează Cazier Judiciar</button>
                  </div>
                </div>
              )
            )}

            {/* ----- SECȚIUNE REPREZENTANT SCOALA ----- */}
            {isReprezentant && (
              ascundeFormularulStandard ? <SuccessBox mesaj="Adeverința școlară a fost generată și atașată la dosar." /> : (
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#1e293b' }}>📝 Completare Adeverință Școlară</h3>
                  <div className="form-row">
                    <div className="form-group"><label>Nume Copil *</label><input type="text" className="form-input" placeholder="Ex: Popescu" value={formScoala.nume_copil} onChange={e => setFormScoala({ ...formScoala, nume_copil: e.target.value })} /></div>
                    <div className="form-group"><label>Prenume Copil *</label><input type="text" className="form-input" placeholder="Ex: Ionuț" value={formScoala.prenume_copil} onChange={e => setFormScoala({ ...formScoala, prenume_copil: e.target.value })} /></div>
                  </div>
                  <div className="form-group"><label>CNP Copil *</label><input type="text" className="form-input" maxLength={13} placeholder="Introduceți CNP copil" value={formScoala.cnp_copil} onChange={e => setFormScoala({ ...formScoala, cnp_copil: e.target.value.replace(/\D/g, '') })} /></div>
                  <div className="form-group"><label>Clasa / Grupa</label><input type="text" className="form-input" placeholder="Ex: a VIII-a B" value={formScoala.clasa} onChange={e => setFormScoala({ ...formScoala, clasa: e.target.value })} /></div>
                  <div className="form-group"><label>Media generală / Calificative</label><input type="text" className="form-input" placeholder="Ex: 9.50" value={formScoala.media} onChange={e => setFormScoala({ ...formScoala, media: e.target.value })} /></div>
                  <div className="form-group"><label>Număr absențe nemotivate</label><input type="number" className="form-input" placeholder="Ex: 0" value={formScoala.nr_absente} onChange={e => setFormScoala({ ...formScoala, nr_absente: e.target.value })} /></div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={finalizeazaAdeverintaScoala} disabled={savingStatus}>🖨️ Generare Adeverință Școlară</button>
                  </div>
                </div>
              )
            )}

            {/* ----- SECȚIUNE MEDIC (STANDARD - HANDICAP) ----- */}
            {isMedic && !isAdoptie && (
              ascundeFormularulStandard ? <SuccessBox mesaj="Scrisoarea medicală a fost generată și atașată la dosar." /> : (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <button className={`btn ${tipFormMedic === 'familie' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTipFormMedic('familie')}>🩺 Medic de Familie</button>
                    <button className={`btn ${tipFormMedic === 'specialist' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTipFormMedic('specialist')}>🔬 Medic Specialist</button>
                  </div>
                  {tipFormMedic === 'familie' ? (
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#1e293b' }}>Scrisoare Medicală (Medic de Familie)</h3>
                      <div className="form-group"><label>Anamneza</label><textarea className="form-textarea" rows="2" value={formMedicFam.anamneza} onChange={e => setFormMedicFam({ ...formMedicFam, anamneza: e.target.value })}></textarea></div>
                      <div className="form-group"><label>Diagnostic principal</label><input type="text" className="form-input" value={formMedicFam.diagnostic_principal} onChange={e => setFormMedicFam({ ...formMedicFam, diagnostic_principal: e.target.value })} /></div>
                      <div className="form-group"><label>Diagnostice secundare</label><textarea className="form-textarea" rows="2" value={formMedicFam.diagnostic_secundar} onChange={e => setFormMedicFam({ ...formMedicFam, diagnostic_secundar: e.target.value })}></textarea></div>
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label>Internări în spital</label><button type="button" className="btn btn-sm btn-secondary" onClick={() => setFormMedicFam(f => ({ ...f, internari: [...f.internari, { data_inceput: '', data_sfarsit: '', unitate: '', diagnostic: '' }] }))}>+ Adaugă internare</button></div>
                        {formMedicFam.internari.map((int, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 2fr auto', gap: 8, marginTop: 10, padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <input type="date" className="form-input" value={int.data_inceput} onChange={e => { const upd = [...formMedicFam.internari]; upd[i].data_inceput = e.target.value; setFormMedicFam(f => ({ ...f, internari: upd })); }} />
                            <input type="date" className="form-input" value={int.data_sfarsit} onChange={e => { const upd = [...formMedicFam.internari]; upd[i].data_sfarsit = e.target.value; setFormMedicFam(f => ({ ...f, internari: upd })); }} />
                            <input type="text" className="form-input" placeholder="Unitate medicală" value={int.unitate} onChange={e => { const upd = [...formMedicFam.internari]; upd[i].unitate = e.target.value; setFormMedicFam(f => ({ ...f, internari: upd })); }} />
                            <input type="text" className="form-input" placeholder="Diagnostic" value={int.diagnostic} onChange={e => { const upd = [...formMedicFam.internari]; upd[i].diagnostic = e.target.value; setFormMedicFam(f => ({ ...f, internari: upd })); }} />
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setFormMedicFam(f => ({ ...f, internari: f.internari.filter((_, j) => j !== i) }))}>✖</button>
                          </div>
                        ))}
                      </div>
                      <div className="form-group"><label>Deplasabilitate</label><select className="form-select" value={formMedicFam.deplasabil} onChange={e => setFormMedicFam({ ...formMedicFam, deplasabil: e.target.value })}><option>Este deplasabil(ă) (autonom /cu sprijin)</option><option>Nu este deplasabil(ă)</option></select></div>
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15, color: '#1e293b' }}>Scrisoare Medicală (Medic Specialist)</h3>
                      <div className="form-group"><label>Diagnostic</label><input type="text" className="form-input" value={formMedicSpec.diagnostic} onChange={e => setFormMedicSpec({ ...formMedicSpec, diagnostic: e.target.value })} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Evoluție boală</label><select className="form-select" value={formMedicSpec.evolutie_boala} onChange={e => setFormMedicSpec({ ...formMedicSpec, evolutie_boala: e.target.value })}><option>Staționară</option><option>Progresivă</option><option>Regresivă</option></select></div>
                        <div className="form-group"><label>Prognostic viață</label><select className="form-select" value={formMedicSpec.pronostic_viata} onChange={e => setFormMedicSpec({ ...formMedicSpec, pronostic_viata: e.target.value })}><option>Bun</option><option>Rezervat</option><option>Sever</option></select></div>
                        <div className="form-group"><label>Prognostic vindecare</label><select className="form-select" value={formMedicSpec.pronostic_vindecare} onChange={e => setFormMedicSpec({ ...formMedicSpec, pronostic_vindecare: e.target.value })}><option>Bun</option><option>Rezervat</option><option>Sever</option></select></div>
                      </div>
                      <div className="form-group"><label>Tratamente urmate</label><textarea className="form-textarea" rows="2" value={formMedicSpec.tratamente_urmate} onChange={e => setFormMedicSpec({ ...formMedicSpec, tratamente_urmate: e.target.value })}></textarea></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Răspuns la tratament</label><select className="form-select" value={formMedicSpec.raspuns_tratament} onChange={e => setFormMedicSpec({ ...formMedicSpec, raspuns_tratament: e.target.value })}><option>Bun</option><option>Mediu</option><option>Nesatisfăcător</option></select></div>
                        <div className="form-group"><label>Cooperare medic-pacient</label><select className="form-select" value={formMedicSpec.cooperare} onChange={e => setFormMedicSpec({ ...formMedicSpec, cooperare: e.target.value })}><option>Bună</option><option>Mediocră</option><option>Dificilă</option></select></div>
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={finalizeazaScrisoare} disabled={savingStatus}>🖨️ Generare Scrisoare Medicală</button>
                  </div>
                </>
              )
            )}

            {/* ----- SECȚIUNE MEDIC (ADOPȚIE) - UN FORMULAR PE RÂND, BLOCAT DUPĂ COMPLETARE ----- */}
            {isMedic && isAdoptie && (() => {
              const toateFinalizate = solicitariMedic.length > 0 && solicitariMedic.every(s => s.status === 'finalizata' || s.status === 'finalizat');
              if (toateFinalizate) {
                return <SuccessBox mesaj="Ați completat certificatele medicale pentru toți membrii familiei. Dosarul nu mai poate fi modificat." />;
              }

              // Prima solicitare nefinalizată
              const solCurenta = solicitariMedic.find(s => s.status !== 'finalizata' && s.status !== 'finalizat');
              if (!solCurenta) return null;

              const isTitular = solCurenta.observatii && solCurenta.observatii.includes('Titular');
              const numePacientCurent = isTitular ? `${cetatean.prenume} ${cetatean.nume}` : (partenerInfo ? partenerInfo.numeComplet : 'Soțul/Soția (Partenerul)');
              const cnpPacientCurent = isTitular ? cetatean.cnp : (partenerInfo ? partenerInfo.cnp : 'Conform actului de identitate');
              const currentForm = formMedicAdoptie[solCurenta.id] || { boli: 'Fără boli cronice', istoric: 'Fără istoric relevant', apt: 'ESTE' };
              const solicitariFinalizate = solicitariMedic.filter(s => s.status === 'finalizata' || s.status === 'finalizat');

              return (
                <>
                  {/* Date complete despre toți pacienții - afișate mereu în partea de sus */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>📋 Persoane pentru care se emit certificate medicale</h4>
                    {solicitariMedic.map(sol => {
                      const isTit = sol.observatii && sol.observatii.includes('Titular');
                      const numePers = isTit ? `${cetatean.prenume} ${cetatean.nume}` : (partenerInfo ? partenerInfo.numeComplet : 'Soțul/Soția');
                      const cnpPers = isTit ? cetatean.cnp : (partenerInfo ? partenerInfo.cnp : '-');
                      const fin = sol.status === 'finalizata' || sol.status === 'finalizat';
                      return (
                        <div key={sol.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: fin ? '#f0fdf4' : '#fff', borderRadius: 6, border: `1px solid ${fin ? '#bbf7d0' : '#e2e8f0'}`, marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>👤 {numePers}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>CNP: {cnpPers} · {isTit ? 'Titular' : 'Soț/Soție'}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Adresă: {cetatean.judet} {cetatean.oras}{cetatean.profilCetatean?.adresa_completa ? `, ${cetatean.profilCetatean.adresa_completa}` : ''}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Telefon: {cetatean.telefon || '-'}</div>
                          </div>
                          <span className={`badge badge-${fin ? 'aprobat' : 'incomplet'}`}>{fin ? '✅ Completat' : '⏳ În așteptare'}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Formularul pentru pacientul curent (primul nefinalizat) */}
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>🩺 Certificat Medical Adopție</h3>
                      <span className="badge badge-incomplet">Completați pentru: {numePacientCurent}</span>
                    </div>
                    {solicitariFinalizate.length > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginBottom: 15, fontSize: 13, color: '#166534' }}>
                        ✅ Certificate emise: {solicitariFinalizate.length} din {solicitariMedic.length}. Completați acum pentru <strong>{numePacientCurent}</strong>.
                      </div>
                    )}
                    <div className="form-group">
                      <label>Boli cronice / Afecțiuni psihiatrice</label>
                      <textarea className="form-textarea" value={currentForm.boli} onChange={e => setFormMedic(solCurenta.id, 'boli', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Istoric medical relevant</label>
                      <textarea className="form-textarea" value={currentForm.istoric} onChange={e => setFormMedic(solCurenta.id, 'istoric', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Concluzie (Aptitudine pentru adopție)</label>
                      <select className="form-select" value={currentForm.apt} onChange={e => setFormMedic(solCurenta.id, 'apt', e.target.value)}>
                        <option value="ESTE">ESTE apt pentru adopție</option>
                        <option value="NU ESTE">NU ESTE apt pentru adopție</option>
                      </select>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                      <button className="btn btn-primary" onClick={() => handleGenerareAdoptie('medical_adoptie', { NUME_PACIENT: numePacientCurent, CNP_PACIENT: cnpPacientCurent, BOLI_CRONICE: currentForm.boli, ISTORIC: currentForm.istoric, APT_ADOPTIE: currentForm.apt }, solCurenta.id)} disabled={savingStatus}>
                        🖨️ Emite Certificat pentru {numePacientCurent}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ----- SECȚIUNE PRIMĂRIE (HANDICAP) - rămâne neschimbată ----- */}
            {isFunctionarPrimarie && !isAdoptie && (
              ascundeFormularulStandard ? <SuccessBox mesaj="Ancheta socială a fost finalizată și atașată dosarului." /> : (
                <>
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15 }}>📋 Anchetă Socială</h3>
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>I. Date socio-demografice</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Ocupație</label><input type="text" className="form-input" value={formPrimarie.ocupatia} onChange={e => setPF('ocupatia', e.target.value)} /></div>
                        <div className="form-group"><label>Studii</label><select className="form-select" value={formPrimarie.studii} onChange={e => setPF('studii', e.target.value)}><option>Fără studii</option><option>Primare</option><option>Gimnaziale</option><option>Medii</option><option>Superioare</option></select></div>
                        <div className="form-group"><label>Stare civilă</label><select className="form-select" value={formPrimarie.stare_civila} onChange={e => setPF('stare_civila', e.target.value)}><option>Necăsătorit</option><option>Căsătorit</option><option>Divorțat</option><option>Văduv</option></select></div>
                        <div className="form-group"><label>Are copii?</label><select className="form-select" value={formPrimarie.copii} onChange={e => setPF('copii', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        {formPrimarie.copii === 'Da' && <div className="form-group"><label>Detalii copii</label><input type="text" className="form-input" value={formPrimarie.detalii_copii} onChange={e => setPF('detalii_copii', e.target.value)} /></div>}
                        <div className="form-group"><label>Are reprezentant legal?</label><select className="form-select" value={formPrimarie.reprezentant_legal} onChange={e => setPF('reprezentant_legal', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        {formPrimarie.reprezentant_legal === 'Da' && <div className="form-group"><label>Detalii reprezentant</label><input type="text" className="form-input" value={formPrimarie.detalii_reprezentant} onChange={e => setPF('detalii_reprezentant', e.target.value)} /></div>}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>II. Evaluarea gradului de autonomie</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                        {['Igienă corporală', 'Îmbrăcat/Dezbrăcat', 'Servire și hrănire', 'Mobilizare', 'Deplasare în interior', 'Deplasare în exterior', 'Utilizare mijloace comunicare', 'Prepararea hranei', 'Activități gospodărești', 'Gestionare venituri', 'Cumpărături', 'Administrare tratament', 'Utilizare transport', 'Timp liber'].map((label, i) => {
                          const keys = ['igiena_corporala', 'imbracat_dezbracat', 'servire_hranire', 'mobilizare', 'deplasare_interior', 'deplasare_exterior', 'comunicare_mijloace', 'preparare_hrana', 'activitati_gospodaresti', 'gestionare_venituri', 'cumparaturi', 'administrare_tratament', 'utilizare_transport', 'timp_liber'];
                          return (
                            <div key={i} className="form-group"><label>{label}</label><select className="form-select" value={formPrimarie[keys[i]]} onChange={e => setPF(keys[i], e.target.value)}><option>Fără ajutor</option><option>Cu ajutor parțial</option><option>Cu ajutor integral</option></select></div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>III. Evaluare senzorială și cognitivă</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Memorie</label><select className="form-select" value={formPrimarie.memorie} onChange={e => setPF('memorie', e.target.value)}><option>Își aduce aminte total</option><option>Își aduce aminte parțial</option></select></div>
                        <div className="form-group"><label>Acuitate vizuală</label><select className="form-select" value={formPrimarie.vaz} onChange={e => setPF('vaz', e.target.value)}><option>Completă cu ochelari</option><option>Completă fără ochelari</option></select></div>
                        <div className="form-group"><label>Comunicare</label><select className="form-select" value={formPrimarie.comunicare} onChange={e => setPF('comunicare', e.target.value)}><option>Bună</option><option>Medie</option></select></div>
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>IV. Condiții de locuit și mediu social</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Tip locuință</label><select className="form-select" value={formPrimarie.tip_locuinta} onChange={e => setPF('tip_locuinta', e.target.value)}><option>Casă</option><option>Apartament</option><option>Garsonieră</option><option>Cameră</option><option>Adăpost</option></select></div>
                        <div className="form-group"><label>Nr. camere</label><input type="number" className="form-input" min="1" value={formPrimarie.nr_camere} onChange={e => setPF('nr_camere', e.target.value)} /></div>
                        <div className="form-group"><label>Tip încălzire</label><select className="form-select" value={formPrimarie.incalzire} onChange={e => setPF('incalzire', e.target.value)}><option>Centrală</option><option>Sobă lemne</option><option>Gaze</option><option>Fără</option></select></div>
                        <div className="form-group"><label>Apă curentă</label><select className="form-select" value={formPrimarie.apa_curenta} onChange={e => setPF('apa_curenta', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                      </div>
                      <div className="form-group"><label>Dotări locuință</label><textarea className="form-textarea" rows="2" value={formPrimarie.dotari_locuinta} onChange={e => setPF('dotari_locuinta', e.target.value)} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 10 }}>
                        <div className="form-group"><label>Coabitare</label><select className="form-select" value={formPrimarie.coabitare} onChange={e => setPF('coabitare', e.target.value)}><option>Cu familia</option><option>Singur</option><option>Cu alte persoane</option></select></div>
                        <div className="form-group"><label>Coabitant cu boli</label><select className="form-select" value={formPrimarie.coabitant_bolnav} onChange={e => setPF('coabitant_bolnav', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        <div className="form-group"><label>Coabitant cu adicții</label><select className="form-select" value={formPrimarie.coabitant_adictii} onChange={e => setPF('coabitant_adictii', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        <div className="form-group"><label>Relație familie</label><select className="form-select" value={formPrimarie.relatie_familie} onChange={e => setPF('relatie_familie', e.target.value)}><option>Bună</option><option>Conflictuală</option><option>Inexistentă</option></select></div>
                        <div className="form-group"><label>Risc neglijare</label><select className="form-select" value={formPrimarie.risc_neglijare} onChange={e => setPF('risc_neglijare', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        <div className="form-group"><label>Risc abuz</label><select className="form-select" value={formPrimarie.risc_abuz} onChange={e => setPF('risc_abuz', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                      </div>
                      <div className="form-group" style={{ marginTop: 10 }}><label>Persoană de contact</label><input type="text" className="form-input" value={formPrimarie.pers_contact} onChange={e => setPF('pers_contact', e.target.value)} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 10 }}>
                        <div className="form-group"><label>Are prieteni?</label><select className="form-select" value={formPrimarie.are_prieteni} onChange={e => setPF('are_prieteni', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                        <div className="form-group"><label>Participare comunitate</label><select className="form-select" value={formPrimarie.participare_comunitate} onChange={e => setPF('participare_comunitate', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                      </div>
                    </div>
                    <div className="form-group"><label>Concluzii generale</label><textarea className="form-textarea" rows="3" value={formPrimarie.concluzii} onChange={e => setPF('concluzii', e.target.value)} /></div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                      <button className="btn btn-primary" onClick={finalizeazaAnchetaPrimarie} disabled={savingStatus}>🖨️ Generare Anchetă Socială</button>
                    </div>
                  </div>
                </>
              )
            )}

            {/* ----- SECȚIUNE PRIMĂRIE (ADOPȚIE) - EVIDENȚA PERSOANELOR ----- */}
            {isFunctionarPrimarie && isAdoptie && isEvidenta && (
              areDomiciliu ? <SuccessBox mesaj="Adeverința de domiciliu a fost generată și atașată dosarului." /> : (
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15 }}>🏠 Verificare Domiciliu (Evidența Persoanelor)</h3>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>📋 Date cetățean</div>
                    <div style={{ fontSize: 13, color: '#1e293b' }}>👤 <strong>{cetatean.prenume} {cetatean.nume}</strong> · CNP: {cetatean.cnp}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Județ: {cetatean.judet} · Localitate: {cetatean.oras}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Adresă declarată: <strong>{cetatean.profilCetatean?.adresa_completa || 'Necompletată'}</strong></div>
                    {partenerInfo && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: 13, color: '#1e293b' }}>👤 <strong>{partenerInfo.numeComplet}</strong> · CNP: {partenerInfo.cnp} · Soț/Soție</div>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Confirmare adresă</label>
                    <select className="form-select" value={formDomiciliu.confirmare} onChange={e => setFormDomiciliu({ ...formDomiciliu, confirmare: e.target.value })}>
                      <option>Da, locuiește la adresa declarată</option>
                      <option>Nu locuiește la adresa declarată</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Detalii suplimentare</label>
                    <textarea className="form-textarea" value={formDomiciliu.detalii} onChange={e => setFormDomiciliu({ ...formDomiciliu, detalii: e.target.value })} />
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={() => handleGenerareAdoptie('domiciliu', { ADRESA_COMPLETA: cetatean.profilCetatean?.adresa_completa || '-', CONFIRMARE_ADRESA: formDomiciliu.confirmare, DETALII_ADRESA: formDomiciliu.detalii })} disabled={savingStatus}>🖨️ Certifică Domiciliul</button>
                  </div>
                </div>
              )
            )}

            {/* ----- SECȚIUNE PRIMĂRIE (ADOPȚIE) - ASISTENȚĂ SOCIALĂ ----- */}
            {isFunctionarPrimarie && isAdoptie && isAsistenta && (
              areAnchetaAdoptie ? <SuccessBox mesaj="Ancheta Socială pentru adopție a fost finalizată." /> : (
                <>
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 15 }}>🏘️ Anchetă Socială Adopție (Asistență Socială)</h3>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>📋 Date cetățean</div>
                      <div style={{ fontSize: 13, color: '#1e293b' }}>👤 <strong>{cetatean.prenume} {cetatean.nume}</strong> · CNP: {cetatean.cnp}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Județ: {cetatean.judet} · Localitate: {cetatean.oras}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Adresă: {cetatean.profilCetatean?.adresa_completa || 'Necompletată'} · Telefon: {cetatean.telefon || '-'}</div>
                      {partenerInfo && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: 13, color: '#1e293b' }}>👤 <strong>{partenerInfo.numeComplet}</strong> · CNP: {partenerInfo.cnp} · Soț/Soție</div>
                        </div>
                      )}
                    </div>

                    {/* SECȚIUNEA I - identică cu ancheta handicap */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>I. Condiții de locuire</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Tip locuință</label><select className="form-select" value={formPrimarie.tip_locuinta} onChange={e => setPF('tip_locuinta', e.target.value)}><option>Casă</option><option>Apartament</option><option>Garsonieră</option><option>Cameră</option><option>Adăpost</option></select></div>
                        <div className="form-group"><label>Nr. camere</label><input type="number" className="form-input" min="1" value={formPrimarie.nr_camere} onChange={e => setPF('nr_camere', e.target.value)} /></div>
                        <div className="form-group"><label>Tip încălzire</label><select className="form-select" value={formPrimarie.incalzire} onChange={e => setPF('incalzire', e.target.value)}><option>Centrală</option><option>Sobă lemne</option><option>Gaze</option><option>Fără</option></select></div>
                        <div className="form-group"><label>Apă curentă</label><select className="form-select" value={formPrimarie.apa_curenta} onChange={e => setPF('apa_curenta', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                      </div>
                      <div className="form-group"><label>Dotări locuință</label><textarea className="form-textarea" rows="2" value={formPrimarie.dotari_locuinta} onChange={e => setPF('dotari_locuinta', e.target.value)} /></div>
                    </div>

                    {/* SECȚIUNEA II */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>II. Situație familială și socială</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                        <div className="form-group"><label>Coabitare</label><select className="form-select" value={formPrimarie.coabitare} onChange={e => setPF('coabitare', e.target.value)}><option>Cu familia</option><option>Singur</option><option>Cu alte persoane</option></select></div>
                        <div className="form-group"><label>Relație familie</label><select className="form-select" value={formPrimarie.relatie_familie} onChange={e => setPF('relatie_familie', e.target.value)}><option>Bună</option><option>Conflictuală</option><option>Inexistentă</option></select></div>
                        <div className="form-group"><label>Risc neglijare copil</label><select className="form-select" value={formPrimarie.risc_neglijare} onChange={e => setPF('risc_neglijare', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        <div className="form-group"><label>Risc abuz</label><select className="form-select" value={formPrimarie.risc_abuz} onChange={e => setPF('risc_abuz', e.target.value)}><option>Nu</option><option>Da</option></select></div>
                        <div className="form-group"><label>Persoană de contact</label><input type="text" className="form-input" value={formPrimarie.pers_contact} onChange={e => setPF('pers_contact', e.target.value)} /></div>
                        <div className="form-group"><label>Participare comunitate</label><select className="form-select" value={formPrimarie.participare_comunitate} onChange={e => setPF('participare_comunitate', e.target.value)}><option>Da</option><option>Nu</option></select></div>
                      </div>
                    </div>

                    {/* SECȚIUNEA III - specifică adopției */}
                    <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 15 }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>III. Evaluare specifică adopție</h4>
                      <div className="form-group"><label>Descrierea locuinței (condiții pentru copil)</label><textarea className="form-textarea" rows="2" value={formAnchetaAdoptie.locuinte} onChange={e => setFormAnchetaAdoptie({ ...formAnchetaAdoptie, locuinte: e.target.value })} /></div>
                      <div className="form-group"><label>Situație financiară / Venituri familie</label><textarea className="form-textarea" rows="2" value={formAnchetaAdoptie.venituri} onChange={e => setFormAnchetaAdoptie({ ...formAnchetaAdoptie, venituri: e.target.value })} /></div>
                      <div className="form-group"><label>Istoric familial relevant</label><textarea className="form-textarea" rows="2" value={formAnchetaAdoptie.istoric} onChange={e => setFormAnchetaAdoptie({ ...formAnchetaAdoptie, istoric: e.target.value })} /></div>
                      <div className="form-group"><label>Motivația pentru adopție</label><textarea className="form-textarea" rows="2" value={formAnchetaAdoptie.motivatie} onChange={e => setFormAnchetaAdoptie({ ...formAnchetaAdoptie, motivatie: e.target.value })} /></div>
                      <div className="form-group"><label>Concluzie anchetă</label><select className="form-select" value={formAnchetaAdoptie.concluzie} onChange={e => setFormAnchetaAdoptie({ ...formAnchetaAdoptie, concluzie: e.target.value })}><option>Apt pentru adopție</option><option>Inapt pentru adopție</option><option>Necesită evaluare suplimentară</option></select></div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 15, textAlign: 'right' }}>
                      <button className="btn btn-primary" onClick={() => handleGenerareAdoptie('ancheta_adoptie', { CONDITII_LOCATIVE: formAnchetaAdoptie.locuinte, VENITURI: formAnchetaAdoptie.venituri, ISTORIC_FAMILIAL: formAnchetaAdoptie.istoric, MOTIVATIE: formAnchetaAdoptie.motivatie, CONCLUZIE_ANCHETA: formAnchetaAdoptie.concluzie })} disabled={savingStatus}>🖨️ Generează Anchetă Adopție</button>
                    </div>
                  </div>
                </>
              )
            )}

            {/* MODUL UNIC PENTRU SEMNĂTURA EXTERNI (Doar dacă există formulare deschise) */}
            {arataSignaturePad && (
              <div className="form-group" style={{ background: '#fff', border: '1px solid var(--border)', padding: 16, borderRadius: 8, marginTop: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--blue)', marginBottom: 10 }}>✒️ Căsuța pentru semnătura dvs. digitală</label>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>Semnați aici înainte de a da click pe butonul de "Generare" din formularele de mai sus.</p>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 8, width: 400, background: '#f8fafc', marginTop: 6 }}>
                  <canvas ref={canvasRef} width={400} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} style={{ cursor: 'crosshair' }} />
                </div>
                <button type="button" onClick={curataSemnatura} className="text-link" style={{ marginTop: 5, background: 'none', border: 'none', fontSize: 12 }}>Curăță semnătura</button>
              </div>
            )}
          </div>
        </div>

      ) : (

        /* --- LAYOUT STANDARD CETĂȚEAN / ADMIN / MANAGER --- */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {dosar.status === 'aprobat' && (
              <div style={{ padding: 20, background: '#e6f4ea', border: '2px solid #34a853', borderRadius: 8 }}>
                <h3 style={{ color: '#137333', margin: '0 0 10px 0', fontSize: 16 }}>✅ DOSAR APROBAT</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#137333', lineHeight: 1.5 }}>
                  {(isCopilDosar || isAdoptie) ? 'Dreptul a fost acordat și decizia a fost înregistrată.' : 'Certificatul a fost emis și trimis către cetățean.'}
                </p>
              </div>
            )}

            {dosar.status === 'respins' && (
              <div style={{ padding: 20, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 8 }}>
                <h3 style={{ color: '#dc2626', margin: '0 0 10px 0', fontSize: 16 }}>❌ DOSAR RESPINS</h3>
                {dosar.motiv_respingere && <p style={{ margin: 0, fontSize: 14, color: '#dc2626' }}>Motiv: {dosar.motiv_respingere}</p>}
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
                  <div className="form-group"><label>Noul status</label><select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                  <button className="btn btn-primary" onClick={saveStatus} disabled={savingStatus}>Aplica</button>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Descrierea situației</div>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{descriereCurata}</p>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Documente atașate</div>
              </div>
              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item" style={{ alignItems: 'center', background: doc.tip_document === 'decizie' ? '#f0f9ff' : 'transparent', border: doc.tip_document === 'decizie' ? '1px solid #bae6fd' : '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontWeight: doc.tip_document === 'decizie' ? 'bold' : 'normal', color: doc.tip_document === 'decizie' ? 'var(--blue)' : 'inherit' }}>
                      {doc.tip_document === 'decizie' ? '🏆 ' : '📄 '}
                      {doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {doc.validat ? <span className="badge badge-aprobat">✓ Aprobat</span> : <span className="badge badge-incomplet">⏳ În verificare</span>}
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}/${doc.cale_fisier}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">👁 Vezi</a>
                    </div>
                  </div>
                ))}
              </div>
              {!esteFinalizat && isCetatean && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadDocument} />
                  <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Se încarcă...' : '+ Adaugă document'}</button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar dreapta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title" style={{ marginBottom: 14 }}>Statusul dosarului</div>
              <Timeline status={dosar.status} />
            </div>

            {functionar && (
              <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Funcționar alocat</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                    {`${functionar.prenume?.[0] || ''}${functionar.nume?.[0] || ''}`}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{functionar.prenume} {functionar.nume}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{functionar.email}</div>
                  </div>
                </div>
              </div>
            )}

            {programareExistenta && (
              <div className="card" style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div className="card-title" style={{ marginBottom: 12, color: 'var(--blue)' }}>📅 Programare comisie</div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ marginBottom: 6 }}><strong>Data:</strong> {new Date(programareExistenta.data_ora_programare || programareExistenta.data_ora).toLocaleString('ro-RO')}</div>
                  <div style={{ marginBottom: 6 }}><strong>Locație:</strong> {programareExistenta.locatie || 'Sediul DGASPC'}</div>
                  <div><strong>Durată:</strong> {programareExistenta.durata_minute || 30} minute</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}