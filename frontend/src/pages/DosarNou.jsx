import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import SignaturePad from 'signature_pad';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TIPURI = [
  { value: 'certificat_handicap', label: '📄 Certificat de handicap', desc: 'Evaluare și eliberare certificat grad de handicap pentru adulți/copii' },
  { value: 'adoptie',             label: '👨‍👩‍👧 Adopție',                  desc: 'Deschidere procedură de adopție națională sau internațională' },
  { value: 'plasament',           label: '🏠 Plasament familial',          desc: 'Plasament copil în familie substitutivă sau la asistent maternal' },
  { value: 'alocatie',            label: '💰 Alocație de stat',            desc: 'Alocație pentru copii sau alocație de plasament' },
  { value: 'alte_servicii',       label: '🤝 Alte servicii sociale',       desc: 'Asistență pentru familii în dificultate sau alte servicii DGASPC' },
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

const ORASE_PER_JUDET = {
  'Alba': ['Alba Iulia', 'Sebeș', 'Aiud', 'Cugir', 'Blaj'],
  'Arad': ['Arad', 'Pecica', 'Sântana', 'Lipova', 'Ineu'],
  'Argeș': ['Pitești', 'Mioveni', 'Câmpulung', 'Curtea de Argeș'],
  'Bacău': ['Bacău', 'Onești', 'Moinești', 'Comănești'],
  'Bihor': ['Oradea', 'Salonta', 'Marghita', 'Săcueni'],
  'Bistrița-Năsăud': ['Bistrița', 'Năsăud', 'Beclean'],
  'Botoșani': ['Botoșani', 'Dorohoi', 'Darabani'],
  'Brașov': ['Brașov', 'Făgăraș', 'Săcele', 'Zărnești', 'Codlea'],
  'Brăila': ['Brăila', 'Ianca', 'Însurăței'],
  'Buzău': ['Buzău', 'Râmnicu Sărat', 'Nehoiu'],
  'Caraș-Severin': ['Reșița', 'Caransebeș', 'Bocșa'],
  'Călărași': ['Călărași', 'Oltenița', 'Lehliu-Gară'],
  'Cluj': ['Cluj-Napoca', 'Turda', 'Dej', 'Câmpia Turzii', 'Gherla'],
  'Constanța': ['Constanța', 'Mangalia', 'Medgidia', 'Năvodari'],
  'Covasna': ['Sfântu Gheorghe', 'Târgu Secuiesc', 'Covasna'],
  'Dâmbovița': ['Târgoviște', 'Moreni', 'Pucioasa', 'Găești'],
  'Dolj': ['Craiova', 'Băilești', 'Calafat', 'Filiași'],
  'Galați': ['Galați', 'Tecuci', 'Târgu Bujor'],
  'Giurgiu': ['Giurgiu', 'Bolintin-Vale'],
  'Gorj': ['Târgu Jiu', 'Motru', 'Rovinari'],
  'Harghita': ['Miercurea Ciuc', 'Odorheiu Secuiesc', 'Gheorgheni'],
  'Hunedoara': ['Deva', 'Hunedoara', 'Petroșani', 'Vulcan'],
  'Ialomița': ['Slobozia', 'Fetești', 'Urziceni'],
  'Iași': ['Iași', 'Pașcani', 'Hârlău', 'Târgu Frumos'],
  'Ilfov': ['Voluntari', 'Pantelimon', 'Buftea', 'Popești-Leordeni', 'Otopeni'],
  'Maramureș': ['Baia Mare', 'Sighetu Marmației', 'Borșa'],
  'Mehedinți': ['Drobeta-Turnu Severin', 'Orșova', 'Strehaia'],
  'Mureș': ['Târgu Mureș', 'Reghin', 'Sighișoara'],
  'Neamț': ['Piatra Neamț', 'Roman', 'Târgu Neamț'],
  'Olt': ['Slatina', 'Caracal', 'Balș'],
  'Prahova': ['Ploiești', 'Câmpina', 'Băicoi', 'Breaza'],
  'Satu Mare': ['Satu Mare', 'Carei', 'Negrești-Oaș'],
  'Sălaj': ['Zalău', 'Șimleu Silvaniei', 'Jibou'],
  'Sibiu': ['Sibiu', 'Mediaș', 'Cisnădie', 'Avrig'],
  'Suceava': ['Suceava', 'Fălticeni', 'Rădăuți', 'Câmpulung Moldovenesc'],
  'Teleorman': ['Alexandria', 'Roșiorii de Vede', 'Turnu Măgurele'],
  'Timiș': ['Timișoara', 'Lugoj', 'Sânnicolau Mare', 'Jimbolia'],
  'Tulcea': ['Tulcea', 'Babadag', 'Măcin'],
  'Vaslui': ['Vaslui', 'Bârlad', 'Huși'],
  'Vâlcea': ['Râmnicu Vâlcea', 'Drăgășani', 'Băbeni'],
  'Vrancea': ['Focșani', 'Adjud', 'Mărășești']
};

const SPECIALITATI_MEDICALE = [
  'Cardiologie', 'Neurologie', 'Ortopedie', 'Psihiatrie', 'Oftalmologie', 
  'ORL', 'Oncologie', 'Medicină Internă', 'Chirurgie', 'Pneumologie', 'Diabet și Nutriție'
];

export default function DosarNou() {
  const navigate  = useNavigate();
  const { utilizator, checkAuth } = useAuth();
  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [dosarId, setDosarId]     = useState(null);

  // Form state generic
  const [tip, setTip]             = useState('');
  const [prioritate, setPrioritate] = useState('normal');
  const [descriere, setDescriere] = useState('');
  const [fisiere, setFisiere]     = useState([]);

  // STATE MEDICI DIN BAZA DE DATE
  const [mediciDB, setMediciDB] = useState([]);

  // Form state PAS 1
  const [dateCerere, setDateCerere] = useState({
    serie_ci: '', numar_ci: '',
    strada: '', tip_cerere: 'dosar_nou', acord_corectitudine: false, acord_gdpr: false,
  });

  // Form state PAS 3
  const [docIdentitate, setDocIdentitate] = useState(null);
  const [docVenit, setDocVenit] = useState(null);
  const [medicFam, setMedicFam] = useState({
    acelasiJudet: true, judet: '', medic: ''
  });
  const [referate, setReferate] = useState([]);

  const isHandicap = tip === 'certificat_handicap';
  const activeSteps = isHandicap
    ? ['Tip dosar', 'Formular Cerere', 'Informații', 'Documente', 'Semnătură', 'Confirmare']
    : ['Tip dosar', 'Informații', 'Documente', 'Semnătură', 'Confirmare'];

  const canvasRef    = useRef(null);
  const signPadRef   = useRef(null);
  const fileInputRef = useRef(null);

  // FETCH MEDICI DIN DB PENTRU DROPDOWN-URI
  useEffect(() => {
    if (isHandicap) {
      api.get('/auth/medici')
         .then(res => setMediciDB(res.data))
         .catch(err => console.error("Eroare la aducerea medicilor:", err));
    }
  }, [isHandicap]);

  // Funcții inteligente de filtrare medici (reparate)
  const judetMedicFam = medicFam.acelasiJudet ? utilizator?.judet : medicFam.judet;
  
  const mediciFamilie = judetMedicFam
    ? mediciDB.filter(m => {
        const specDB = (m.specialitate || '').toLowerCase();
        const judetDB = m.judet || '';
        return specDB.includes('familie') && judetDB === judetMedicFam;
      })
    : [];

  const getMediciSpecialisti = (judet, spec) => {
    if (!judet || !spec) return [];
    
    return mediciDB.filter(m => {
      const specDB = m.specialitate || '';
      const judetDB = m.judet || '';
      
      const formatStr = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      
      return formatStr(specDB) === formatStr(spec) && formatStr(judetDB) === formatStr(judet);
    });
  };

  useEffect(() => {
    if (step === 4 && canvasRef.current && !signPadRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)', penColor: '#1e2f5c',
        minWidth: 1.5, maxWidth: 3,
      });
      signPadRef.current = pad;
      resizeCanvas();
    }
  }, [step]);

  const resizeCanvas = () => {
    if (!canvasRef.current) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const canvas = canvasRef.current;
    canvas.width  = canvas.offsetWidth  * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    if (signPadRef.current) signPadRef.current.clear();
  };

  const clearSignature = () => {
    signPadRef.current?.clear();
  };

  const adaugaReferat = () => {
    setReferate([...referate, { id: Date.now(), specialitate: '', judet: '', medic: '' }]);
  };

  const updateReferat = (id, key, value) => {
    setReferate(referate.map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const stergeReferat = (id) => {
    setReferate(referate.filter(r => r.id !== id));
  };

  const nextStep = async () => {
    if (step === 0) {
      if (!tip) return toast.warning('Selectați tipul dosarului');
      setStep(isHandicap ? 1 : 2);
    } 
    else if (step === 1) {
      if (!dateCerere.serie_ci || !dateCerere.numar_ci || !dateCerere.strada) {
        return toast.warning('Vă rugăm completați seria CI, numărul CI și strada.');
      }
      if (!dateCerere.acord_corectitudine || !dateCerere.acord_gdpr) {
        return toast.warning('Bifați ambele acorduri la finalul formularului pentru a continua.');
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
      if (!descriere.trim()) return toast.warning('Descrieți situația dvs.');
      setStep(3);
    } 
    else if (step === 3) {
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step === 2) setStep(isHandicap ? 1 : 0);
    else setStep((s) => s - 1);
  };

  let uiStepIndex = step;
  if (!isHandicap && step >= 2) uiStepIndex = step - 1;

  const BoxIncarcare = ({ label, file, setFile }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{label}</label>
      {file ? (
         <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid #bbf7d0', borderRadius: 6 }}>
           <span style={{ fontSize: 18 }}>📄</span>
           <span style={{ flex: 1, fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>{file.name}</span>
           <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--danger)' }} onClick={() => setFile(null)}>✖</button>
         </div>
      ) : (
         <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', transition: '0.2s' }}>
           <span style={{ fontSize: 18 }}>📂</span>
           <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>Click pentru a alege un fișier (PDF/JPG)</span>
           <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files[0])} />
         </label>
      )}
    </div>
  );

  const uploadSpecificFile = async (file, dosar_id, tip_doc) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('fisier', file);
    fd.append('dosar_id', dosar_id);
    fd.append('tip_document', tip_doc);
    await api.post('/documente/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
  };

  const creeazaDosar = async () => {
    setLoading(true);
    try {
      const { data: dosar } = await api.post('/dosare', { tip, descriere, prioritate });
      setDosarId(dosar.id);

      if (isHandicap) {
        await uploadSpecificFile(docIdentitate, dosar.id, 'carte_identitate');
        await uploadSpecificFile(docVenit, dosar.id, 'alte');
        // Au fost eliminate documentele fizice (scrisoare medicala/referate) la cererea ta
      } else {
        for (let i = 0; i < fisiere.length; i++) {
          await uploadSpecificFile(fisiere[i], dosar.id, 'alte');
        }
      }

      let sigData = null;
      if (signPadRef.current && !signPadRef.current.isEmpty()) {
        sigData = signPadRef.current.toDataURL('image/png');
        await api.post('/documente/semnatura', { dosar_id: dosar.id, semnatura_base64: sigData });
      }

      if (isHandicap) {
        try {
          await api.post('/documente/genereaza-cerere-handicap', {
            dosar_id: dosar.id, date_cerere: dateCerere, semnatura_base64: sigData
          });
          await new Promise(resolve => setTimeout(resolve, 500)); 
        } catch (err) { console.error("Eroare la generarea cererii PDF:", err); }

                const mediciDeNotificat = [];

if (medicFam.medic) {
  const obj = mediciDB.find(m => String(m.id) === String(medicFam.medic));
  if (obj) mediciDeNotificat.push({
    id:           obj.id,
    email:        obj.email,
    prenume:      obj.prenume,
    nume:         obj.nume,
    specialitate: 'Medicină de familie',
    tip:          'Medic de Familie',
  });
}

referate.forEach(r => {
  if (r.medic) {
    const obj = mediciDB.find(m => String(m.id) === String(r.medic));
    if (obj) mediciDeNotificat.push({
      id:           obj.id,
      email:        obj.email,
      prenume:      obj.prenume,
      nume:         obj.nume,
      specialitate: r.specialitate,
      tip:          `Medic Specialist (${r.specialitate})`,
    });
  }
});
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
                <button className="btn btn-primary" onClick={nextStep}>Continuare ➡️</button>
              </div>
            </>
          )}

          {/* PASUL 1 (Pentru Handicap) */}
          {step === 1 && isHandicap && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Date personale și Adresă</div>
                  <div className="card-subtitle">Informațiile de mai jos vor fi folosite pentru generarea cererii oficiale.</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nume și Prenume (precompletat)</label>
                  <input type="text" className="form-input" 
                     value={`${utilizator?.nume || ''} ${utilizator?.prenume || ''}`} 
                     disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
                <div className="form-group">
                  <label>CNP (precompletat)</label>
                  <input type="text" className="form-input" 
                     value={utilizator?.cnp || ''} 
                     disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email (precompletat)</label>
                  <input type="email" className="form-input" 
                     value={utilizator?.email || ''} 
                     disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
                <div className="form-group">
                  <label>Telefon (precompletat)</label>
                  <input type="text" className="form-input" 
                     value={utilizator?.telefon || ''} 
                     disabled style={{ background: 'var(--bg)', color: 'var(--text-2)' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Serie CI *</label>
                  <input type="text" className="form-input" placeholder="ex: XT" 
                     value={dateCerere.serie_ci} onChange={(e) => setDateCerere({...dateCerere, serie_ci: e.target.value.toUpperCase()})} maxLength={2} />
                </div>
                <div className="form-group">
                  <label>Număr CI *</label>
                  <input type="text" className="form-input" placeholder="ex: 123456" 
                     value={dateCerere.numar_ci} onChange={(e) => setDateCerere({...dateCerere, numar_ci: e.target.value.replace(/\D/g, '')})} maxLength={6} />
                </div>
              </div>

              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>Adresa de domiciliu</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Județ / Sector</label>
                    <input 
                      type="text" className="form-input"
                      value={utilizator?.judet || ''} 
                      disabled 
                      style={{ background: 'var(--bg)', color: 'var(--text-2)' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Oraș / Comună</label>
                    <input 
                      type="text" className="form-input"
                      value={utilizator?.oras || ''} 
                      disabled 
                      style={{ background: 'var(--bg)', color: 'var(--text-2)' }}
                    />
                  </div>
                </div>
                {(!utilizator?.judet || !utilizator?.oras) && (
                  <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 12 }}>
                    ⚠️ Județul și orașul nu sunt completate în profilul dvs.{' '}
                    <a href="/profil" style={{ color: 'var(--blue)' }}>Actualizați profilul</a> înainte de a continua.
                  </p>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Detalii adresă (Stradă, număr, bloc, apartament) *</label>
                  <input type="text" className="form-input" placeholder="ex: Bd. Unirii, nr. 10, bl. A, ap. 5" 
                     value={dateCerere.strada} onChange={(e) => setDateCerere({...dateCerere, strada: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label>Acest dosar reprezintă o cerere pentru: *</label>
                <select className="form-input" value={dateCerere.tip_cerere} onChange={(e) => setDateCerere({...dateCerere, tip_cerere: e.target.value})}>
                  <option value="dosar_nou">Dosar Nou</option>
                  <option value="reevaluare_expirat">Reevaluare pentru dosar expirat</option>
                  <option value="reevaluare_agravare">Reevaluare pentru agravare stare de sănătate</option>
                </select>
              </div>

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

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>⬅️ Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare ➡️</button>
              </div>
            </>
          )}

          {/* PASUL 2 */}
          {step === 2 && (
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
                      {p === 'urgent' ? '🔴 Urgent' : '🔵 Normal'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Descrierea situației *</label>
                <textarea className="form-textarea" rows={6} 
                  placeholder="Informații care considerați că vor fi utile comisiei de evaluare..."
                  value={descriere} onChange={(e) => setDescriere(e.target.value)} 
                  style={{ minHeight: 140 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>⬅️ Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare ➡️</button>
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

              {/* 1. Identitate & Venituri */}
              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>1. Documente de bază</h4>
                <BoxIncarcare label="Act de identitate (Buletin / CI) *" file={docIdentitate} setFile={setDocIdentitate} />
                <BoxIncarcare label="Document privind veniturile (Adeverință salariat / Cupon pensie / ANAF) *" file={docVenit} setFile={setDocVenit} />
              </div>

              {/* 2. Medicul de Familie */}
              <div style={{ background: 'var(--surface)', padding: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-1)' }}>2. Solicitare Scrisoare Medicală Tip</h4>
                
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 'normal' }}>
                    <input type="checkbox" style={{ width: 18, height: 18 }} 
                       checked={medicFam.acelasiJudet} 
                       onChange={(e) => {
                        setMedicFam({...medicFam, acelasiJudet: e.target.checked, judet: e.target.checked ? utilizator?.judet : '', medic: ''});
                      }} />
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
                    <select 
                      className="form-input" 
                      value={medicFam.medic} 
                      onChange={(e) => setMedicFam({...medicFam, medic: e.target.value})} 
                      disabled={!judetMedicFam}
                    >
                      <option value="">{judetMedicFam ? (mediciFamilie.length > 0 ? 'Alege medicul...' : 'Niciun medic găsit în acest județ') : 'Alegeți întâi județul'}</option>
                      {mediciFamilie.map(m => (
                        <option key={m.id} value={m.id}>
                          Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p style={{fontSize: 12, color: 'var(--text-3)'}}>*Medicul va fi notificat automat să completeze scrisoarea online, direct în platformă.</p>
              </div>

              {/* 3. Referate Medicale (Specialiști) */}
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
                          {mediciSpecialistiDisponibili.map(m => (
                           <option key={m.id} value={m.id}>
                            Dr. {m.prenume} {m.nume} {m.oras ? `(${m.oras})` : ''}
                            </option>
                          ))}
                          </select>
                        </div>
                        <p style={{fontSize: 12, color: 'var(--text-3)'}}>*Medicul va completa referatul direct în platformă.</p>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>⬅️ Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare ➡️</button>
              </div>
            </>
          ) : step === 3 && !isHandicap ? (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Încărcați documentele anexă</div>
                  <div className="card-subtitle">Formate acceptate: PDF, JPG, PNG · Maxim 5 MB per fișier</div>
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
                <button className="btn btn-secondary" onClick={prevStep}>⬅️ Înapoi</button>
                <button className="btn btn-primary" onClick={nextStep}>Continuare ➡️</button>
              </div>
            </>
          ) : null}

          {/* PASUL 4: Semnătură */}
          {step === 4 && (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">Semnătură electronică olografă</div>
                  <div className="card-subtitle">Semnați câmpul de mai jos pentru a certifica autenticitatea cererii</div>
                </div>
              </div>
              <div className="sign-wrap">
                <canvas ref={canvasRef} style={{ width: '100%', height: 200, touchAction: 'none' }} />
                <div className="sign-actions">
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 'auto' }}>Semnați cu mouse-ul sau degetul (touchscreen)</span>
                  <button className="btn btn-ghost btn-sm" onClick={clearSignature}>Șterge</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={prevStep}>⬅️ Înapoi</button>
                <button className="btn btn-primary" onClick={() => setStep(5)}>Continuare ➡️</button>
              </div>
            </>
          )}

          {/* PASUL 5: Confirmare */}
          {step === 5 && dosarId ? (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ width: 72, height: 72, background: 'var(--success-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>✅</div>
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
                <button className="btn btn-secondary" onClick={() => setStep(4)}>⬅️ Înapoi</button>
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