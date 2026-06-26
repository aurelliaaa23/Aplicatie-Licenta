import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import SignaturePad from 'signature_pad';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TIPURI = [
  { value: 'certificat_handicap', label: '📄 Certificat de handicap', desc: 'Evaluare și eliberare certificat grad de handicap pentru adulți/copii' },
  { value: 'alocatie',            label: '🏫 Alocație de stat (2-18 ani)', desc: 'Acordare alocație de stat pentru copil' },
  { value: 'indemnizatie',        label: '🍼 Indemnizație creștere copil (0-2 ani)', desc: 'Acordare indemnizație lunară creștere copil' },
  { value: 'adoptie',             label: '👨‍👩‍👧 Adopție',                  desc: 'Deschidere procedură de adopție națională sau internațională' },
  { value: 'plasament',           label: '🏡 Plasament familial',          desc: 'Plasament copil în familie substitutivă sau la asistent maternal' },
  { value: 'alte_servicii',       label: '📋 Alte servicii sociale',       desc: 'Asistență pentru familii în dificultate sau alte servicii DGASPC' },
];

const JUDETE = [
  'București - Sector 1', 'București - Sector 2', 'București - Sector 3', 
  'București - Sector 4', 'București - Sector 5', 'București - Sector 6',
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 
  'Brăila', 'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 
  'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 
  'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 
  'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 
  'Vâlcea', 'Vrancea'
];

const SPECIALITATI_MEDICALE = [
  'Medicină de familie', 'Cardiologie', 'Neurologie', 'Ortopedie', 'Psihiatrie', 'Oftalmologie', 
  'ORL', 'Oncologie', 'Medicină Internă', 'Chirurgie', 'Pneumologie', 'Diabet și Nutriție'
];

export default function DosarNou() {
  const navigate  = useNavigate();
  const { utilizator, checkAuth } = useAuth();
  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [dosarId, setDosarId]     = useState(null);
  
  const [tip, setTip]             = useState('');
  const [prioritate, setPrioritate] = useState('normal');
  const [descriere, setDescriere] = useState('');
  const [fisiere, setFisiere]     = useState([]);
  
  const [mediciDB, setMediciDB] = useState([]);
  const [cadreDidactice, setCadreDidactice] = useState([]);

  const [dateCerere, setDateCerere] = useState({
    serie_ci: '', numar_ci: '',
    strada: '', tip_cerere: 'dosar_nou', acord_corectitudine: false, acord_gdpr: false,
  });

  const [dateFamilie, setDateFamilie] = useState({
    cetateanUe: false, tipFamilie: 'monoparentala', cnpSot: '', numeSot: ''
  });

  const [dateCopil, setDateCopil] = useState({
    nume: '', prenume: '', cnp: ''
  });

  const [dateAlocatie, setDateAlocatie] = useState({
    acelasiJudet: true, judet: '', tipCadru: '', cadruDidacticId: ''
  });

  const [dateIndemnizatie, setDateIndemnizatie] = useState({ beneficiar: 'titular' });

  // STATE NOU: Adopție
  const [dateAdoptie, setDateAdoptie] = useState({
    gen_copil: 'indiferent', greu_adoptabil: 'Nu',
  });

  const [docIdentitate, setDocIdentitate] = useState(null);
  const [docVenit, setDocVenit] = useState(null);
  const [docCIParinti, setDocCIParinti] = useState(null);
  const [docCertNastere, setDocCertNastere] = useState(null);
  const [docExtrasCont, setDocExtrasCont] = useState(null);
  const [docCertCasatorie, setDocCertCasatorie] = useState(null);
  const [docAdevMunca, setDocAdevMunca] = useState(null);

  const [medicFam, setMedicFam] = useState({ acelasiJudet: true, judet: '', medic: '' });
  const [medicFamSot, setMedicFamSot] = useState({ acelasiJudet: true, judet: '', medic: '' }); // Medic pt sotie/sot in caz de adoptie
  const [referate, setReferate] = useState([]);

  const isHandicap = tip === 'certificat_handicap';
  const isCopil = tip === 'alocatie' || tip === 'indemnizatie';
  const isAdoptie = tip === 'adoptie';

  let activeSteps = ['Tip dosar', 'Informații', 'Documente', 'Semnătură', 'Confirmare'];
  if (isHandicap) activeSteps = ['Tip dosar', 'Formular Cerere', 'Informații', 'Documente', 'Semnătură', 'Confirmare'];
  if (isCopil) activeSteps = ['Tip dosar', 'Date Identificare Copil & Familie', tip === 'alocatie' ? 'Detalii Școală' : 'Detalii Indemnizație', 'Documente', 'Semnătură', 'Confirmare'];
  if (isAdoptie) activeSteps = ['Tip dosar', 'Date Titular & Familie', 'Criterii & Medici', 'Documente', 'Semnături', 'Confirmare'];

  const canvasRef      = useRef(null);
  const signPadRef     = useRef(null);
  const canvasSotRef   = useRef(null);
  const signPadSotRef  = useRef(null);
  const fileInputRef   = useRef(null);

  useEffect(() => {
    // Aducem medicii din BD atât pt Handicap cât și pt Adopție
    if (isHandicap || isAdoptie) {
      api.get('/auth/medici')
         .then(res => setMediciDB(res.data))
         .catch(err => console.error("Eroare la aducerea medicilor:", err));
    }
    if (isCopil && tip === 'alocatie') {
      api.get('/auth/cadre-didactice')
         .then(res => setCadreDidactice(res.data))
         .catch(err => console.error("Eroare cadre didactice:", err));
    }
  }, [isHandicap, isCopil, isAdoptie, tip]);

  // Filtrare Medici Titular
  const judetMedicFam = medicFam.acelasiJudet ? utilizator?.judet : medicFam.judet;
  const mediciFamilie = judetMedicFam
    ? mediciDB.filter(m => (m.specialitate || '').toLowerCase().includes('familie') && (m.judet || '') === judetMedicFam)
    : [];

  // Filtrare Medici Soț/Soție
  const judetMedicFamSot = medicFamSot.acelasiJudet ? utilizator?.judet : medicFamSot.judet;
  const mediciFamilieSot = judetMedicFamSot
    ? mediciDB.filter(m => (m.specialitate || '').toLowerCase().includes('familie') && (m.judet || '') === judetMedicFamSot)
    : [];

  const getMediciSpecialisti = (judet, spec) => {
    if (!judet || !spec) return [];
    return mediciDB.filter(m => {
      const formatStr = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return formatStr(m.specialitate || '') === formatStr(spec) && formatStr(m.judet || '') === formatStr(judet);
    });
  };

  const judetScoala = dateAlocatie.acelasiJudet ? utilizator?.judet : dateAlocatie.judet;
  
  const cadreFiltrate = cadreDidactice.filter(cd => {
    const formatStr = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const matchJudet = !judetScoala || formatStr(cd.judet || '') === formatStr(judetScoala);
    const matchTip = !dateAlocatie.tipCadru || formatStr(cd.tip || '').includes(formatStr(dateAlocatie.tipCadru));
    return matchJudet && matchTip;
  });

  const handleCnpSotChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setDateFamilie({ ...dateFamilie, cnpSot: val, numeSot: '' });
    if (val.length === 13) {
      try {
        const { data } = await api.get(`/auth/cauta-cnp/${val}`);
        if (data && data.nume) {
            setDateFamilie(prev => ({ ...prev, numeSot: `${data.prenume} ${data.nume}` }));
            toast.success('Soțul/Soția a fost găsit(ă) în baza de date!');
        }
      } catch (err) {
        setDateFamilie(prev => ({ ...prev, numeSot: 'Nu a fost găsit în platformă (va depune fizic o copie CI)' }));
      }
    }
  };

  useEffect(() => {
    if (step === 4) {
      if (canvasRef.current && !signPadRef.current) {
        const pad = new SignaturePad(canvasRef.current, { backgroundColor: 'rgb(255, 255, 255)', penColor: '#1e2f5c', minWidth: 1.5, maxWidth: 3 });
        signPadRef.current = pad;
      }
      
      // Inițializare pad suplimentar pentru partener (doar la adopție integrală)
      if (isAdoptie && dateFamilie.tipFamilie === 'integrala' && canvasSotRef.current && !signPadSotRef.current) {
        const padSot = new SignaturePad(canvasSotRef.current, { backgroundColor: 'rgb(255, 255, 255)', penColor: '#1e2f5c', minWidth: 1.5, maxWidth: 3 });
        signPadSotRef.current = padSot;
      }
      
      resizeCanvas();
    }
  }, [step, isAdoptie, dateFamilie.tipFamilie]);

  const resizeCanvas = () => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    if (canvasRef.current) {
      canvasRef.current.width  = canvasRef.current.offsetWidth  * ratio;
      canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
      canvasRef.current.getContext('2d').scale(ratio, ratio);
      if (signPadRef.current) signPadRef.current.clear();
    }
    if (canvasSotRef.current) {
      canvasSotRef.current.width  = canvasSotRef.current.offsetWidth  * ratio;
      canvasSotRef.current.height = canvasSotRef.current.offsetHeight * ratio;
      canvasSotRef.current.getContext('2d').scale(ratio, ratio);
      if (signPadSotRef.current) signPadSotRef.current.clear();
    }
  };

  const clearSignature = () => signPadRef.current?.clear();
  const clearSignatureSot = () => signPadSotRef.current?.clear();

  const adaugaReferat = () => setReferate([...referate, { id: Date.now(), specialitate: '', judet: '', medic: '' }]);
  const updateReferat = (id, key, value) => setReferate(referate.map(r => r.id === id ? { ...r, [key]: value } : r));
  const stergeReferat = (id) => setReferate(referate.filter(r => r.id !== id));

  const nextStep = async () => {
    if (step === 0) {
      if (!tip) return toast.warning('Selectați tipul dosarului');
      setStep(isHandicap || isCopil || isAdoptie ? 1 : 2);
    } 
    else if (step === 1) {
      if (!dateCerere.serie_ci || !dateCerere.numar_ci || !dateCerere.strada) return toast.warning('Vă rugăm completați seria CI, numărul CI și strada.');
      if (!dateCerere.acord_corectitudine || !dateCerere.acord_gdpr) return toast.warning('Bifați ambele acorduri generale (corectitudine și GDPR).');
      
      if (isCopil || isAdoptie) {
        if (isCopil && (!dateCopil.nume || !dateCopil.prenume || dateCopil.cnp.length !== 13)) return toast.warning('Vă rugăm să completați datele copilului corect (CNP din 13 cifre).');
        if (!dateFamilie.cetateanUe) return toast.warning('Bifați confirmarea că sunteți cetățean UE.');
        if (dateFamilie.tipFamilie === 'integrala' && dateFamilie.cnpSot.length !== 13) return toast.warning('CNP-ul soțului trebuie să fie valid și complet (13 cifre).');
      }

      try {
        await api.patch('/auth/profil', {
          adresa_completa: `${dateCerere.strada}, ${utilizator?.oras || ''}, ${utilizator?.judet || ''}`,
        });
        if (checkAuth) checkAuth();
      } catch (err) { console.error("Eroare update profil", err); }
      setStep(2);
    } 
    else if (step === 2) {
      if (isCopil && tip === 'alocatie') {
          if (!dateAlocatie.acelasiJudet && !dateAlocatie.judet) return toast.warning('Selectați județul instituției!');
          if (!dateAlocatie.tipCadru || !dateAlocatie.cadruDidacticId) return toast.warning('Completați toate informațiile despre școală!');
          setStep(3);
      } else if (isCopil && tip === 'indemnizatie') {
          setStep(3);
      } else if (isAdoptie) {
          if (!medicFam.medic) return toast.warning('Selectați medicul de familie pentru titular!');
          if (dateFamilie.tipFamilie === 'integrala' && !medicFamSot.medic) return toast.warning('Selectați medicul de familie pentru soț/soție!');
          setStep(3);
      } else {
          if (!descriere.trim()) return toast.warning('Descrieți situația dvs.');
          setStep(3);
      }
    } 
    else if (step === 3) {
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step === 2) setStep(isHandicap || isCopil || isAdoptie ? 1 : 0);
    else setStep((s) => s - 1);
  };

  let uiStepIndex = step;
  if (!isHandicap && !isCopil && !isAdoptie && step >= 2) uiStepIndex = step - 1;

  const BoxIncarcare = ({ label, file, setFile }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {file ? (
         <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid #bbf7d0', borderRadius: 6 }}>
           <span style={{ fontSize: 18 }}>✅</span>
           <span style={{ flex: 1, fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>{file.name}</span>
           <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--danger)' }} onClick={() => setFile(null)}>✖</button>
         </div>
      ) : (
         <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', transition: '0.2s' }}>
           <span style={{ fontSize: 18 }}>📁</span>
           <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>Click pentru a alege un fișier (PDF/JPG)</span>
           <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files[0])} />
         </label>
      )}
    </div>
  );

  const uploadSpecificFile = async (file, dosar_id, tip_doc) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('fisier', file); fd.append('dosar_id', dosar_id); fd.append('tip_document', tip_doc);
    await api.post('/documente/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
  };

  const creeazaDosar = async () => {
    setLoading(true);
    try {
      let payloadDescriere = descriere;
      if (isCopil) payloadDescriere = `[Date Copil: ${dateCopil.nume} ${dateCopil.prenume}, CNP: ${dateCopil.cnp}]\n\n${descriere || 'Dosar pentru acordare beneficiu social copii'}`;
      if (isAdoptie) {
  const partenerStr = dateFamilie.tipFamilie === 'integrala' ? `[Partener: ${dateFamilie.numeSot}, CNP: ${dateFamilie.cnpSot}]\n` : '';
  payloadDescriere = `Dosar de adopție națională.\n${partenerStr}\n${descriere}`;
}

      const { data: dosar } = await api.post('/dosare', { tip, descriere: payloadDescriere, prioritate });
      setDosarId(dosar.id);
      
      // Upload documente în funcție de dosar
      if (isHandicap) {
        await uploadSpecificFile(docIdentitate, dosar.id, 'carte_identitate');
        await uploadSpecificFile(docVenit, dosar.id, 'alte');
      } else if (isCopil) {
        await uploadSpecificFile(docCIParinti, dosar.id, 'ci_parinti');
        await uploadSpecificFile(docCertNastere, dosar.id, 'cert_nastere');
        await uploadSpecificFile(docExtrasCont, dosar.id, 'extras_cont');
        if (dateFamilie.tipFamilie === 'integrala' && docCertCasatorie) await uploadSpecificFile(docCertCasatorie, dosar.id, 'cert_casatorie');
        if (tip === 'indemnizatie' && docAdevMunca) await uploadSpecificFile(docAdevMunca, dosar.id, 'adev_munca');
      } else if (isAdoptie) {
        await uploadSpecificFile(docCIParinti, dosar.id, 'ci_parinti');
        if (dateFamilie.tipFamilie === 'integrala') {
           await uploadSpecificFile(docCertCasatorie, dosar.id, 'cert_casatorie');
        }
      } else {
        for (let i = 0; i < fisiere.length; i++) await uploadSpecificFile(fisiere[i], dosar.id, 'alte');
      }

      // Procesare Semnături
      let sigData = signPadRef.current && !signPadRef.current.isEmpty() ? signPadRef.current.toDataURL('image/png') : null;
      let sigSotData = (dateFamilie.tipFamilie === 'integrala' && signPadSotRef.current && !signPadSotRef.current.isEmpty()) ? signPadSotRef.current.toDataURL('image/png') : null;

      if (sigData) {
        try { await api.post('/documente/semnatura', { dosar_id: dosar.id, semnatura_base64: sigData }); } catch (e) { console.warn("Eroare la semnatură.", e); }
      }

      // Generări automate și notificări medici
      if (isHandicap) {
        try {
          await api.post('/documente/genereaza-cerere-handicap', { dosar_id: dosar.id, date_cerere: dateCerere, semnatura_base64: sigData });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {}
        
        const mediciDeNotificat = [];
        if (medicFam.medic) mediciDeNotificat.push({ id: medicFam.medic, nume: medicFam.medic, tip: 'Medic de Familie' });
        referate.forEach(r => { if (r.medic) mediciDeNotificat.push({ id: r.medic, nume: r.medic, tip: `Medic Specialist` }); });
        if (mediciDeNotificat.length > 0) {
          try { await api.post(`/dosare/${dosar.id}/notifica-medici`, { medici: mediciDeNotificat }); } catch (err) {}
        }
      }
      else if (isCopil) {
        try {
          await api.post('/documente/genereaza-cerere-copil', { 
            dosar_id: dosar.id, tip_dosar: tip, date_cerere: dateCerere, 
            date_familie: dateFamilie, date_indemnizatie: dateIndemnizatie,
            date_copil: dateCopil, semnatura_base64: sigData 
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) { console.error("Eroare la generarea cererii", err); }
      }
      else if (isAdoptie) {
         try {
           await api.post('/documente/genereaza-cerere-adoptie', {
              dosar_id: dosar.id, date_cerere: dateCerere, date_adoptie: dateAdoptie, 
              date_familie: dateFamilie, semnatura_base64: sigData, semnatura_sot_base64: sigSotData
           });
           await new Promise(resolve => setTimeout(resolve, 500));
         } catch (err) { console.error("Eroare la generare cerere adoptie", err); }
         
         const mediciDeNotificat = [];
         if (medicFam.medic) mediciDeNotificat.push({ id: medicFam.medic, tip: 'Adeverință medicală adopție (Titular)' });
         if (dateFamilie.tipFamilie === 'integrala' && medicFamSot.medic) {
            mediciDeNotificat.push({ id: medicFamSot.medic, tip: 'Adeverință medicală adopție (Soț/Soție)' });
         }
         
         if (mediciDeNotificat.length > 0) {
           try { await api.post(`/dosare/${dosar.id}/notifica-medici`, { medici: mediciDeNotificat }); } catch (err) {}
         }
      }

      if (isCopil && tip === 'alocatie' && dateAlocatie.cadruDidacticId) {
          try { await api.post(`/dosare/${dosar.id}/notifica-reprezentant`, { 
              reprezentant_id: dateAlocatie.cadruDidacticId,
              date_copil: dateCopil
          }); } catch (e) { console.warn(e); }
      }

      setStep(5);
      toast.success('Dosar depus cu succes!');
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Eroare la depunerea dosarului');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Dosar nou">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="page-header">
          <h2>Depunere dosar nou</h2>
          <p>Completați formularul pas cu pas. Datele dvs. sunt securizate și confidențiale.</p>
        </div>
        
        <div className="stepper" style={{ marginBottom: 28 }}>
          {activeSteps.map((label, i) => (
            <div key={i} className={`step ${i < uiStepIndex ? 'done' : i === uiStepIndex ? 'active' : ''}`}>
              <div className="step-circle">{i < uiStepIndex ? '✓' : i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          
          {/* PASUL 0 */}
          {step === 0 && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Selectați tipul dosarului</div>
                  <div className="card-subtitle">Alegeți categoria care corespunde situației dvs.</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {TIPURI.map((t) => (
                  <div key={t.value} onClick={() => setTip(t.value)} style={{
                    padding: '16px 18px', borderRadius: 'var(--radius)',
                    border: `2px solid ${tip === t.value ? 'var(--blue)' : 'var(--border)'}`,
                    background: tip === t.value ? 'var(--blue-pale)' : 'var(--surface)',
                    cursor: 'pointer', transition: 'var(--transition)',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: tip === t.value ? 'var(--blue)' : 'var(--text-1)', marginBottom: 6 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          )}

          {/* PASUL 1: Formular Comun */}
          {step === 1 && (isHandicap || isCopil || isAdoptie) && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Date personale și Identificare</div>
                  <div className="card-subtitle">Informațiile de mai jos vor fi folosite pentru generarea cererii.</div>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Nume și Prenume (precompletat)</label>
                  <input type="text" className="form-input" value={`${utilizator?.nume || ''} ${utilizator?.prenume || ''}`} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
                <div className="form-group">
                  <label>CNP (precompletat)</label>
                  <input type="text" className="form-input" value={utilizator?.cnp || ''} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email (precompletat)</label>
                  <input type="email" className="form-input" value={utilizator?.email || ''} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
                <div className="form-group">
                  <label>Telefon (precompletat)</label>
                  <input type="text" className="form-input" value={utilizator?.telefon || ''} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Serie CI *</label>
                  <input type="text" className="form-input" placeholder="ex: XT" value={dateCerere.serie_ci} onChange={(e) => setDateCerere({...dateCerere, serie_ci: e.target.value.toUpperCase()})} maxLength={2} />
                </div>
                <div className="form-group">
                  <label>Număr CI *</label>
                  <input type="text" className="form-input" placeholder="ex: 123456" value={dateCerere.numar_ci} onChange={(e) => setDateCerere({...dateCerere, numar_ci: e.target.value.replace(/\D/g, '')})} maxLength={6} />
                </div>
              </div>

              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Adresa de domiciliu</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Județ / Sector</label>
                    <input type="text" className="form-input" value={utilizator?.judet || ''} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                  </div>
                  <div className="form-group">
                    <label>Oraș / Comună</label>
                    <input type="text" className="form-input" value={utilizator?.oras || ''} disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Detalii adresă (Stradă, număr, bloc, apartament) *</label>
                  <input type="text" className="form-input" placeholder="ex: Bd. Unirii, nr. 10, bl. A, ap. 5" value={dateCerere.strada} onChange={(e) => setDateCerere({...dateCerere, strada: e.target.value})} />
                </div>
              </div>

              {isHandicap && (
                  <div className="form-group">
                    <label>Acest dosar reprezintă o cerere pentru: *</label>
                    <select className="form-input" value={dateCerere.tip_cerere} onChange={(e) => setDateCerere({...dateCerere, tip_cerere: e.target.value})}>
                      <option value="dosar_nou">Dosar Nou</option>
                      <option value="reevaluare_expirat">Reevaluare pentru dosar expirat</option>
                      <option value="reevaluare_agravare">Reevaluare pentru agravare stare de sănătate</option>
                    </select>
                  </div>
              )}

              {isCopil && (
                  <div style={{ background: 'var(--info-bg)', padding: 16, border: '1px solid #bae6fd', borderRadius: 8, marginTop: 24, marginBottom: 24 }}>
                      <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Informații Copil</h4>
                      <div className="form-row">
                          <div className="form-group">
                              <label>Nume Copil *</label>
                              <input type="text" className="form-input" placeholder="Nume" value={dateCopil.nume} onChange={e => setDateCopil({...dateCopil, nume: e.target.value})} />
                          </div>
                          <div className="form-group">
                              <label>Prenume Copil *</label>
                              <input type="text" className="form-input" placeholder="Prenume" value={dateCopil.prenume} onChange={e => setDateCopil({...dateCopil, prenume: e.target.value})} />
                          </div>
                      </div>
                      <div className="form-group">
                          <label>CNP Copil *</label>
                          <input type="text" className="form-input" maxLength={13} placeholder="Introduceți CNP copil" value={dateCopil.cnp} onChange={e => setDateCopil({...dateCopil, cnp: e.target.value.replace(/\D/g, '')})} />
                      </div>
                  </div>
              )}

              {(isCopil || isAdoptie) && (
                  <div style={{ background: 'var(--info-bg)', padding: 16, border: '1px solid #bae6fd', borderRadius: 8, marginTop: 24, marginBottom: 24 }}>
                      <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Informații Familie</h4>
                      <div className="form-group">
                          <label>Tipul Familiei dvs. *</label>
                          <select className="form-select" value={dateFamilie.tipFamilie} onChange={e => setDateFamilie({...dateFamilie, tipFamilie: e.target.value})}>
                              <option value="monoparentala">Familie monoparentală (Un singur părinte)</option>
                              <option value="integrala">Familie integrală (Căsătoriți / Doi părinți)</option>
                          </select>
                      </div>
                      {dateFamilie.tipFamilie === 'integrala' && (
                          <div className="form-row">
                              <div className="form-group">
                                  <label>CNP Soț/Soție *</label>
                                  <input type="text" className="form-input" maxLength={13} placeholder="Introduceți CNP" value={dateFamilie.cnpSot} onChange={handleCnpSotChange} />
                              </div>
                              <div className="form-group">
                                  <label>Nume Soț/Soție (Validare sistem)</label>
                                  <input type="text" className="form-input" disabled style={{ background: 'var(--bg)' }} value={dateFamilie.numeSot || (dateFamilie.cnpSot.length === 13 ? 'Se caută...' : '')} />
                              </div>
                          </div>
                      )}
                  </div>
              )}

              <div className="form-group" style={{ marginTop: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                  <input type="checkbox" style={{ width: 18, height: 18 }} checked={dateCerere.acord_corectitudine} onChange={(e) => setDateCerere({...dateCerere, acord_corectitudine: e.target.checked})} />
                  <span style={{ fontSize: 13.5 }}>Declar pe propria răspundere că datele introduse sunt corecte și corespund cu realitatea.</span>
                </label>
              </div>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                  <input type="checkbox" style={{ width: 18, height: 18 }} checked={dateCerere.acord_gdpr} onChange={(e) => setDateCerere({...dateCerere, acord_gdpr: e.target.checked})} />
                  <span style={{ fontSize: 13.5 }}>Sunt de acord cu prelucrarea datelor cu caracter personal de către DGASPC conform normelor GDPR.</span>
                </label>
              </div>

              {(isCopil || isAdoptie) && (
                  <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                          <input type="checkbox" style={{ width: 18, height: 18 }} checked={dateFamilie.cetateanUe} onChange={(e) => setDateFamilie({...dateFamilie, cetateanUe: e.target.checked})} />
                          <span style={{ fontSize: 13.5 }}>Declar pe propria răspundere că sunt cetățean al Uniunii Europene.</span>
                      </label>
                  </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          )}

          {/* PASUL 2: INFORMATII / DETALII ALOCATIE / DETALII INDEMNIZATIE / ADOPTIE */}
          {step === 2 && !isCopil && !isAdoptie && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Informații suplimentare</div>
                  <div className="card-subtitle">Descrieți pe scurt motivul depunerii acestui dosar.</div>
                </div>
              </div>
              <div className="form-group">
                <label>Prioritate</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['normal', 'urgent'].map((p) => (
                    <button key={p} type="button" onClick={() => setPrioritate(p)} className={`btn ${prioritate === p ? 'btn-primary' : 'btn-secondary'}`}>
                      {p === 'urgent' ? '🔴 Urgent' : '🟢 Normal'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Descrierea situației *</label>
                <textarea className="form-textarea" rows={6} 
                  placeholder="Informații care considerați vor fi utile..."
                  value={descriere} onChange={(e) => setDescriere(e.target.value)} 
                  style={{ minHeight: 140 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          )}

          {step === 2 && isAdoptie && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Criterii Adopție & Medici de Familie</div>
                  <div className="card-subtitle">Selectați preferințele privind copilul și medicii care vor emite certificatele medicale.</div>
                </div>
              </div>
              
              <div className="form-row">
                 <div className="form-group">
                     <label>Genul copilului dorit *</label>
                     <select className="form-select" value={dateAdoptie.gen_copil} onChange={e => setDateAdoptie({...dateAdoptie, gen_copil: e.target.value})}>
                         <option value="indiferent">Indiferent (Băiat / Fată)</option>
                         <option value="baiat">Băiat</option>
                         <option value="fata">Fată</option>
                     </select>
                 </div>
                 <div className="form-group">
                     <label>Disponibilitate copil greu adoptabil? *</label>
                     <select className="form-select" value={dateAdoptie.greu_adoptabil} onChange={e => setDateAdoptie({...dateAdoptie, greu_adoptabil: e.target.value})}>
                         <option value="Nu">Nu</option>
                         <option value="Da">Da (Vârstă &gt;4 ani, afecțiuni, frați)</option>
                     </select>
                 </div>
              </div>

              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginTop: 16 }}>
                 <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Solicitare Certificat Medical Adopție (Pentru dvs.)</h4>
                 <div className="form-group">
                   <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                     <input type="checkbox" style={{ width: 18, height: 18 }} checked={medicFam.acelasiJudet} onChange={(e) => setMedicFam({...medicFam, acelasiJudet: e.target.checked, judet: e.target.checked ? utilizator?.judet : '', medic: ''})} />
                     <span style={{ fontSize: 13.5 }}>Medicul dvs. de familie este din același județ cu domiciliul dvs.?</span>
                   </label>
                 </div>
                 <div className="form-row">
                   {!medicFam.acelasiJudet && (
                     <div className="form-group">
                       <label>Selectați Județul medicului</label>
                       <select className="form-input" value={medicFam.judet} onChange={(e) => setMedicFam({...medicFam, judet: e.target.value, medic: ''})}>
                         <option value="">Alege județul...</option>
                         {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
                       </select>
                     </div>
                   )}
                   <div className="form-group" style={{ flex: 2 }}>
                     <label>Medic Familie (Titular) *</label>
                     <select className="form-input" value={medicFam.medic} onChange={(e) => setMedicFam({...medicFam, medic: e.target.value})} disabled={!judetMedicFam}>
                       <option value="">{judetMedicFam ? (mediciFamilie.length > 0 ? 'Alege medicul...' : 'Niciun medic găsit în acest județ') : 'Alegeți județul'}</option>
                       {mediciFamilie.map(m => <option key={m.id} value={m.id}>Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}</option>)}
                     </select>
                   </div>
                 </div>
              </div>

              {dateFamilie.tipFamilie === 'integrala' && (
                  <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginTop: 16 }}>
                     <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Solicitare Certificat Medical Adopție (Pentru soț/soție)</h4>
                     <div className="form-group">
                       <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                         <input type="checkbox" style={{ width: 18, height: 18 }} checked={medicFamSot.acelasiJudet} onChange={(e) => setMedicFamSot({...medicFamSot, acelasiJudet: e.target.checked, judet: e.target.checked ? utilizator?.judet : '', medic: ''})} />
                         <span style={{ fontSize: 13.5 }}>Medicul de familie al soțului/soției este din același județ?</span>
                       </label>
                     </div>
                     <div className="form-row">
                       {!medicFamSot.acelasiJudet && (
                         <div className="form-group">
                           <label>Selectați Județul medicului</label>
                           <select className="form-input" value={medicFamSot.judet} onChange={(e) => setMedicFamSot({...medicFamSot, judet: e.target.value, medic: ''})}>
                             <option value="">Alege județul...</option>
                             {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
                           </select>
                         </div>
                       )}
                       <div className="form-group" style={{ flex: 2 }}>
                         <label>Medic Familie (Soț/Soție) *</label>
                         <select className="form-input" value={medicFamSot.medic} onChange={(e) => setMedicFamSot({...medicFamSot, medic: e.target.value})} disabled={!judetMedicFamSot}>
                           <option value="">{judetMedicFamSot ? (mediciFamilieSot.length > 0 ? 'Alege medicul...' : 'Niciun medic găsit în acest județ') : 'Alegeți județul'}</option>
                           {mediciFamilieSot.map(m => <option key={m.id} value={m.id}>Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}</option>)}
                         </select>
                       </div>
                     </div>
                  </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          )}

          {step === 2 && isCopil && (
             <>
               <div className="card-header">
                  <div>
                    <div className="card-title">{tip === 'alocatie' ? 'Detalii Școlare Copil' : 'Detalii Indemnizație'}</div>
                    <div className="card-subtitle">Completați datele specifice pentru acordarea drepturilor bănești.</div>
                  </div>
               </div>

               {tip === 'alocatie' ? (
                   <>
                       <div className="form-group">
                           <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                               <input 
                                  type="checkbox" style={{ width: 18, height: 18 }} 
                                  checked={dateAlocatie.acelasiJudet} 
                                  onChange={e => setDateAlocatie({...dateAlocatie, acelasiJudet: e.target.checked, judet: e.target.checked ? utilizator?.judet : '', cadruDidacticId: ''})} 
                               />
                               <span style={{ fontSize: 13.5 }}>Instituția de învățământ este în același județ cu domiciliul meu?</span>
                           </label>
                       </div>

                       <div className="form-row">
                           {!dateAlocatie.acelasiJudet && (
                               <div className="form-group">
                                   <label>Județ Instituție *</label>
                                   <select className="form-input" value={dateAlocatie.judet} onChange={(e) => setDateAlocatie({...dateAlocatie, judet: e.target.value, cadruDidacticId: ''})}>
                                       <option value="">Alege județul...</option>
                                       {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
                                   </select>
                               </div>
                           )}

                           <div className="form-group" style={{ flex: 2 }}>
                               <label>Tip Cadru Didactic *</label>
                               <select className="form-select" value={dateAlocatie.tipCadru} onChange={e => setDateAlocatie({...dateAlocatie, tipCadru: e.target.value, cadruDidacticId: ''})}>
                                   <option value="">Alege...</option>
                                   <option value="educator">Educator (Grădiniță)</option>
                                   <option value="invatator">Învățător (Clasele I-IV)</option>
                                   <option value="profesor">Profesor Diriginte (Clasele V-XII)</option>
                               </select>
                           </div>
                       </div>

                       <div className="form-group">
                           <label>Reprezentant Învățământ (din baza de date) *</label>
                           <select className="form-select" value={dateAlocatie.cadruDidacticId} onChange={e => setDateAlocatie({...dateAlocatie, cadruDidacticId: e.target.value})} disabled={!judetScoala || !dateAlocatie.tipCadru}>
                               <option value="">
                                   {judetScoala && dateAlocatie.tipCadru 
                                      ? (cadreFiltrate.length > 0 ? 'Alege persoana care va completa adeverința...' : 'Nicio persoană găsită pentru aceste criterii') 
                                      : 'Alegeți județul și tipul'}
                               </option>
                               {cadreFiltrate.map(cd => (
                                  <option key={cd.id} value={cd.id}>
                                      {cd.prenume} {cd.nume} — {cd.institutie} ({cd.tip})
                                  </option>
                               ))}
                           </select>
                           <p className="form-hint">*Persoana selectată va primi o notificare oficială în platformă pentru a completa adeverința școlară în mod digital.</p>
                       </div>
                   </>
               ) : (
                   <div className="form-group">
                       <label>Cine solicită acordarea indemnizației? *</label>
                       <select className="form-select" value={dateIndemnizatie.beneficiar} onChange={e => setDateIndemnizatie({...dateIndemnizatie, beneficiar: e.target.value})}>
                           <option value="titular">Titularul cererii (Eu)</option>
                           <option value="partener">Partenerul (Soțul / Soția)</option>
                       </select>
                   </div>
               )}

               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                   <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                   <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
               </div>
             </>
          )}

          {/* PASUL 3: Documente */}
          {step === 3 && isHandicap ? (
            <>
              <div className="card-header" style={{ marginBottom: 24 }}>
                <div>
                  <div className="card-title">Încărcare Documente și Selectare Medici</div>
                  <div className="card-subtitle">Vă rugăm atașați documentele suport cerute de lege.</div>
                </div>
              </div>
              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>1. Documente de bază</h4>
                <BoxIncarcare label="Act de identitate (Buletin / CI) *" file={docIdentitate} setFile={setDocIdentitate} />
                <BoxIncarcare label="Document privind veniturile (Adeverință salariat / Cupon pensie) *" file={docVenit} setFile={setDocVenit} />
              </div>
              
              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>2. Solicitare Scrisoare Medicală Tip</h4>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                    <input type="checkbox" style={{ width: 18, height: 18 }} checked={medicFam.acelasiJudet} onChange={(e) => setMedicFam({...medicFam, acelasiJudet: e.target.checked, judet: e.target.checked ? utilizator?.judet : '', medic: ''})} />
                    <span style={{ fontSize: 13.5 }}>Medicul de familie este din același județ cu domiciliul meu?</span>
                  </label>
                </div>
                <div className="form-row">
                  {!medicFam.acelasiJudet && (
                    <div className="form-group">
                      <label>Selectați Județul medicului</label>
                      <select className="form-input" value={medicFam.judet} onChange={(e) => setMedicFam({...medicFam, judet: e.target.value, medic: ''})}>
                        <option value="">Alege județul...</option>
                        {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Selectați Medicul de familie (din baza de date)</label>
                    <select className="form-input" value={medicFam.medic} onChange={(e) => setMedicFam({...medicFam, medic: e.target.value})} disabled={!judetMedicFam}>
                      <option value="">{judetMedicFam ? (mediciFamilie.length > 0 ? 'Alege medicul...' : 'Niciun medic găsit în acest județ') : 'Alegeți județul'}</option>
                      {mediciFamilie.map(m => <option key={m.id} value={m.id}>Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}</option>)}
                    </select>
                  </div>
                </div>
                <p className="form-hint">*Medicul va fi notificat automat să completeze scrisoarea online.</p>
              </div>

              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ fontSize: 14, color: 'var(--text-1)', margin: 0 }}>3. Solicitare Referate Medici Specialiști</h4>
                  <button className="btn btn-secondary btn-sm" onClick={adaugaReferat}>+ Adaugă specialitate</button>
                </div>
                {referate.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', margin: 0 }}>Nu ați adăugat nicio solicitare pentru medici specialiști.</p>
                ) : (
                  referate.map((ref, index) => {
                    const mediciSpecialistiDisponibili = getMediciSpecialisti(ref.judet, ref.specialitate);
                    return (
                      <div key={ref.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 6, marginBottom: 12, background: 'var(--bg)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 12, right: 12 }}>
                           <button onClick={() => stergeReferat(ref.id)} style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Șterge</button>
                        </div>
                        <h5 style={{ fontSize: 13, marginBottom: 12, marginTop: 0 }}>Solicitare Referat #{index + 1}</h5>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Specialitate</label>
                            <select className="form-input" value={ref.specialitate} onChange={(e) => updateReferat(ref.id, 'specialitate', e.target.value)}>
                              <option value="">Alege specialitatea...</option>
                              {SPECIALITATI_MEDICALE.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Județ medic</label>
                            <select className="form-input" value={ref.judet} onChange={(e) => updateReferat(ref.id, 'judet', e.target.value)}>
                              <option value="">Alege județul...</option>
                              {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Medic specialist (din baza de date)</label>
                          <select className="form-input" value={ref.medic} onChange={(e) => updateReferat(ref.id, 'medic', e.target.value)} disabled={!ref.judet || !ref.specialitate}>
                          <option value="">{(ref.judet && ref.specialitate) ? (mediciSpecialistiDisponibili.length > 0 ? 'Alege medicul...' : 'Niciun medic găsit') : 'Alegeți specialitatea și județul'}</option>
                          {mediciSpecialistiDisponibili.map(m => <option key={m.id} value={m.id}>Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          ) : step === 3 && isCopil ? (
            <>
               <div className="card-header" style={{ marginBottom: 24 }}>
                   <div>
                       <div className="card-title">Încărcare Documente Suport</div>
                       <div className="card-subtitle">Vă rugăm atașați documentele obligatorii în format PDF sau JPG.</div>
                   </div>
               </div>
               <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
                   <BoxIncarcare label="Carte de Identitate Părinte/Părinți *" file={docCIParinti} setFile={setDocCIParinti} />
                   <BoxIncarcare label="Certificat de Naștere Copil *" file={docCertNastere} setFile={setDocCertNastere} />
                   <BoxIncarcare label="Extras de Cont (pentru virarea banilor) *" file={docExtrasCont} setFile={setDocExtrasCont} />

                   {dateFamilie.tipFamilie === 'integrala' && (
                       <BoxIncarcare label="Certificat de Căsătorie / Divorț *" file={docCertCasatorie} setFile={setDocCertCasatorie} />
                   )}

                   {tip === 'indemnizatie' && (
                       <BoxIncarcare label="Adeverință de Muncă de la Angajator *" file={docAdevMunca} setFile={setDocAdevMunca} />
                   )}
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                   <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                   <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
               </div>
            </>
          ) : step === 3 && isAdoptie ? (
            <>
               <div className="card-header" style={{ marginBottom: 24 }}>
                   <div>
                       <div className="card-title">Încărcare Documente Suport Adopție</div>
                       <div className="card-subtitle">Vă rugăm atașați copiile după documentele de identitate.</div>
                   </div>
               </div>
               <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
                   <BoxIncarcare label="Copie Carte de Identitate (Toți membrii familiei) *" file={docCIParinti} setFile={setDocCIParinti} />

                   {dateFamilie.tipFamilie === 'integrala' && (
                       <BoxIncarcare label="Copie Certificat de Căsătorie *" file={docCertCasatorie} setFile={setDocCertCasatorie} />
                   )}
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                   <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                   <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
               </div>
            </>
          ) : step === 3 && !isHandicap && !isCopil && !isAdoptie ? (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Încărcați documentele anexă</div>
                  <div className="card-subtitle">Formate acceptate: PDF, JPG, PNG | Maxim 5 MB per fișier</div>
                </div>
              </div>
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()} >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                <p>Trageți fișierele aici sau <strong>click pentru selectare</strong></p>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => setFisiere([...fisiere, ...Array.from(e.target.files)])} />
              </div>
              
              {fisiere.length > 0 && (
                <div className="file-list">
                  {fisiere.map((f, i) => (
                    <div key={i} className="file-item">
                      <span className="file-name">{f.name}</span>
                      <button className="file-remove" onClick={() => setFisiere(fisiere.filter((_, idx) => idx !== i))}>✖</button>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare →</button>
              </div>
            </>
          ) : null}

          {/* PASUL 4: Semnătură */}
          {step === 4 && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Semnătură electronică olografă</div>
                  <div className="card-subtitle">Semnați în câmpul de mai jos pentru a certifica autenticitatea cererii</div>
                </div>
              </div>
              
              {isAdoptie && dateFamilie.tipFamilie === 'integrala' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                   <div>
                      <label style={{ display: 'block', marginBottom: 10, fontWeight: 600 }}>Semnătură Titular</label>
                      <div className="sign-wrap">
                         <canvas ref={canvasRef} style={{ width: '100%', height: 200, touchAction: 'none' }} />
                         <div className="sign-actions">
                            <button className="btn btn-ghost btn-sm" onClick={clearSignature}>Șterge</button>
                         </div>
                      </div>
                   </div>
                   <div>
                      <label style={{ display: 'block', marginBottom: 10, fontWeight: 600 }}>Semnătură Soț/Soție</label>
                      <div className="sign-wrap">
                         <canvas ref={canvasSotRef} style={{ width: '100%', height: 200, touchAction: 'none' }} />
                         <div className="sign-actions">
                            <button className="btn btn-ghost btn-sm" onClick={clearSignatureSot}>Șterge</button>
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="sign-wrap">
                  <canvas ref={canvasRef} style={{ width: '100%', height: 200, touchAction: 'none' }} />
                  <div className="sign-actions">
                    <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 'auto' }}>Semnați cu mouse-ul sau degetul (touchscreen)</span>
                    <button className="btn btn-ghost btn-sm" onClick={clearSignature}>Șterge</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>Înapoi</button>
                <button className="btn btn-primary" onClick={() => setStep(5)}>Continuare →</button>
              </div>
            </>
          )}

          {/* PASUL 5: Confirmare */}
          {step === 5 && dosarId ? (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ width: 72, height: 72, background: 'var(--success-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>✓</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>Dosar depus cu succes!</h3>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
                <button className="btn btn-primary" onClick={() => navigate(`/dosar/${dosarId}`)}>Deschide dosarul meu</button>
              </div>
            </div>
          ) : step === 5 && (
            <>
              <div className="card-header">
                <div><div className="card-title">Confirmare și trimitere</div></div>
              </div>
              
              <div style={{ background: 'var(--warning-bg)', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--warning)', marginBottom: 20 }}>
                  Prin trimiterea acestui dosar, declarați pe propria răspundere că informațiile furnizate sunt corecte.
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => setStep(4)}>Înapoi</button>
                <button className="btn btn-success" onClick={creeazaDosar} disabled={loading}>
                  {loading ? 'Se trimite...' : '✅ Trimite dosarul'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}