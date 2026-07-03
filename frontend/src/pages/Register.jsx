import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STEPS = ['Date personale', 'Cont & parolă', 'Verificare cod'];

const INSTITUTII = ['DGASPC', 'Instituție Învățământ', 'Poliție', 'Primărie'];

const DEPARTAMENTE_PER_INSTITUTIE = {
  'DGASPC': [
    'Evaluare Adulți (SECPAH)',
    'Protecția Copilului',
    'Adopții',
    'Asistență Socială',
    'Relații cu Publicul',
  ],
  'Instituție Învățământ': [
    'Educatori',
    'Învățători',
    'Profesori',
    'Personal Auxiliar',
  ],
  'Poliție': [
    'Eliberare Cazier',
    'Poliția Locală',
  ],
  'Primărie': [
    'Asistență Socială',
    'Evidența Persoanelor',
    'Taxe și Impozite',
    'Direcția Mediului',
  ],
};

const SPECIALITATI = [
  'Medicină de familie',
  'Cardiologie', 'Neurologie', 'Ortopedie', 'Psihiatrie',
  'Oftalmologie', 'ORL', 'Oncologie', 'Medicină Internă',
  'Chirurgie', 'Pneumologie', 'Diabet și Nutriție',
];

const JUDETE = [
  'București - Sector 1', 'București - Sector 2', 'București - Sector 3',
  'București - Sector 4', 'București - Sector 5', 'București - Sector 6',
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov',
  'Brăila', 'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna',
  'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița',
  'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova',
  'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui',
  'Vâlcea', 'Vrancea',
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
  'Dolj': ['Craiova', 'Băilești', 'Calafat', 'Segarcea'],
  'Galați': ['Galați', 'Tecuci', 'Târgu Bujor'],
  'Giurgiu': ['Giurgiu', 'Bolintin-Vale'],
  'Gorj': ['Târgu Jiu', 'Motru', 'Rovinari', 'Turceni'],
  'Harghita': ['Miercurea Ciuc', 'Odorheiu Secuiesc', 'Gheorgheni'],
  'Hunedoara': ['Deva', 'Hunedoara', 'Petroșani', 'Orăștie'],
  'Ialomița': ['Slobozia', 'Fetești', 'Urziceni'],
  'Iași': ['Iași', 'Pașcani', 'Hârlău'],
  'Ilfov': ['Buftea', 'Voluntari', 'Pantelimon', 'Popești-Leordeni'],
  'Maramureș': ['Baia Mare', 'Sighetu Marmației', 'Borșa', 'Vișeu de Sus'],
  'Mehedinți': ['Drobeta-Turnu Severin', 'Orșova', 'Strehaia'],
  'Mureș': ['Târgu Mureș', 'Sighișoara', 'Reghin', 'Târnăveni'],
  'Neamț': ['Piatra Neamț', 'Roman', 'Târgu Neamț'],
  'Olt': ['Slatina', 'Caracal', 'Balș'],
  'Prahova': ['Ploiești', 'Câmpina', 'Sinaia', 'Băicoi', 'Breaza'],
  'Satu Mare': ['Satu Mare', 'Carei', 'Negrești-Oaș'],
  'Sălaj': ['Zalău', 'Șimleu Silvaniei'],
  'Sibiu': ['Sibiu', 'Mediaș', 'Cisnădie'],
  'Suceava': ['Suceava', 'Fălticeni', 'Rădăuți', 'Câmpulung Moldovenesc'],
  'Teleorman': ['Alexandria', 'Roșiori de Vede', 'Turnu Măgurele'],
  'Timiș': ['Timișoara', 'Lugoj', 'Sânnicolau Mare'],
  'Tulcea': ['Tulcea', 'Babadag', 'Măcin'],
  'Vaslui': ['Vaslui', 'Bârlad', 'Huși'],
  'Vâlcea': ['Râmnicu Vâlcea', 'Drăgășani', 'Băbeni'],
  'Vrancea': ['Focșani', 'Adjud', 'Mărășești'],
};

function JudetOrasSelect({ judet, oras, onJudetChange, onOrasChange, eroriJudet, eroriOras, labelJudet = 'Județ *', labelOras = 'Oraș / Comună *' }) {
  const estesBucuresti = judet.startsWith('București');
  const oraseDisponibile = judet && !estesBucuresti ? (ORASE_PER_JUDET[judet] || []) : [];

  return (
    <div className="form-row">
      <div className="form-group">
        <label>{labelJudet}</label>
        <select
          className={`form-input${eroriJudet ? ' error' : ''}`}
          value={judet}
          onChange={(e) => onJudetChange(e.target.value)}
        >
          <option value="">Alege județul...</option>
          {JUDETE.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        {eroriJudet && <p className="form-error">{eroriJudet}</p>}
      </div>
      <div className="form-group">
        <label>{labelOras}</label>
        {estesBucuresti ? (
          <input
            type="text" className="form-input"
            value={judet} disabled
            style={{ background: 'var(--bg)', color: 'var(--text-2)' }}
          />
        ) : (
          <select
            className={`form-input${eroriOras ? ' error' : ''}`}
            value={oras}
            onChange={(e) => onOrasChange(e.target.value)}
            disabled={!judet}
          >
            <option value="">{judet ? 'Alege orașul...' : 'Alege mai întâi județul'}</option>
            {oraseDisponibile.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {eroriOras && <p className="form-error">{eroriOras}</p>}
      </div>
    </div>
  );
}

export default function Register() {
  const { utilizator } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [erori, setErori]         = useState({});
  const [userId, setUserId]       = useState(null);
  const [codEmail, setCodEmail]   = useState('');
  const [countdown, setCountdown] = useState(0);
  const [tipCont, setTipCont]     = useState('cetățean');

const [form, setForm] = useState({
    prenume: '', nume: '', cnp: '', telefon: '',
    email: '', parola: '', confirmare: '',
    institutie: '', departament: '',
    specialitate: '',
    judet: '', oras: '',
    strada: '', numar: '',
  });

  if (utilizator) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErori((er) => ({ ...er, [k]: '' }));
  };

  const setJudet = (val) => {
    setForm((f) => ({ ...f, judet: val, oras: '' }));
    setErori((er) => ({ ...er, judet: '', oras: '' }));
  };

  const setOras = (val) => {
    setForm((f) => ({ ...f, oras: val }));
    setErori((er) => ({ ...er, oras: '' }));
  };

  const setInstitutie = (val) => {
    setForm((f) => ({ ...f, institutie: val, departament: '' }));
    setErori((er) => ({ ...er, institutie: '', departament: '' }));
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
    if (!form.telefon)        e.telefon = 'Telefonul este obligatoriu';

    // CNP obligatoriu pentru toți
    if (!form.cnp || form.cnp.length !== 13 || !/^\d{13}$/.test(form.cnp))
      e.cnp = 'CNP invalid — trebuie să aibă exact 13 cifre';

    if (tipCont === 'cetățean') {
      if (!form.judet) e.judet = 'Selectați județul de domiciliu';
      if (!form.oras && !form.judet.startsWith('București'))
        e.oras = 'Selectați orașul / comuna de domiciliu';
      if (!form.strada.trim()) e.strada = 'Strada este obligatorie';
      if (!form.numar.trim())  e.numar  = 'Numărul este obligatoriu';
    }

    if (tipCont === 'funcționar') {
      if (!form.institutie)  e.institutie  = 'Selectați instituția';
      if (!form.departament) e.departament = 'Selectați departamentul';
      if (!form.judet)       e.judet       = 'Selectați județul instituției';
      if (!form.oras && !form.judet.startsWith('București'))
        e.oras = 'Selectați orașul instituției';
    }

    if (tipCont === 'medic') {
      if (!form.specialitate) e.specialitate = 'Selectați specialitatea';
      if (!form.judet)        e.judet        = 'Selectați județul de practică';
      if (!form.oras && !form.judet.startsWith('București'))
        e.oras = 'Selectați orașul de practică';
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

  const handleRegister = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      const orasFinal = form.judet.startsWith('București') ? form.judet : form.oras;
      const { data } = await api.post('/auth/register', {
        prenume: form.prenume, nume: form.nume,
        email: form.email,     parola: form.parola,
        telefon: form.telefon,
        cnp: form.cnp,
        tipCont,
        institutie:   form.institutie,
        departament:  form.departament,
        specialitate: form.specialitate,
        judet: form.judet,
        oras:  orasFinal,
        strada: form.strada,
        numar:  form.numar,
      });
      setUserId(data.user_id);
      setStep(2);
      startCountdown();
      toast.success('Codul de verificare a fost trimis pe E-mail!');
    } catch (err) {
      const msg = err.response?.data?.eroare || err.message || 'Eroare la înregistrare';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifica = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/verifica-cont', { user_id: userId, cod_email: codEmail });
      toast.success('Cont activat cu succes! Vă puteți autentifica.');
      navigate('/login');
    } catch (err) {
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

  const departamenteDisponibile = DEPARTAMENTE_PER_INSTITUTIE[form.institutie] || [];

  const passwordChecks = [
    [form.parola.length >= 8,          '≥8 caractere'],
    [/[A-Z]/.test(form.parola),        'Literă mare'],
    [/\d/.test(form.parola),           'Cifră'],
    [/[^A-Za-z0-9]/.test(form.parola), 'Caracter special'],
  ];

  return (
    <div className="auth-shell">

      {/* ── Panoul stânga ── */}
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

          {/* ── PASUL 0: Date personale ── */}
          {step === 0 && (
            <>
              {/* Selector tip cont */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface)', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
                {['cetățean', 'funcționar', 'medic'].map(tip => (
                  <button
                    key={tip} type="button"
                    onClick={() => {
                      setTipCont(tip);
                      setForm(f => ({ ...f, cnp: '', institutie: '', departament: '', specialitate: '', judet: '', oras: '' }));
                      setErori({});
                    }}
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

              {/* Nume & Prenume */}
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

              {/* CNP — obligatoriu pentru toți */}
              <div className="form-group">
                <label>CNP *</label>
                <input
                  type="text"
                  className={`form-input${erori.cnp ? ' error' : ''}`}
                  placeholder="1234567890123"
                  maxLength={13}
                  value={form.cnp}
                  onChange={set('cnp')}
                  style={{ fontFamily: 'DM Mono, monospace', letterSpacing: 3 }}
                />
                {erori.cnp && <p className="form-error">{erori.cnp}</p>}
              </div>

              {/* ── CÂMPURI SPECIFICE: CETĂȚEAN ── */}
              {/* ── CÂMPURI SPECIFICE: CETĂȚEAN ── */}
              {tipCont === 'cetățean' && (
                <>
                  <JudetOrasSelect
                    judet={form.judet} oras={form.oras}
                    onJudetChange={setJudet} onOrasChange={setOras}
                    eroriJudet={erori.judet} eroriOras={erori.oras}
                    labelJudet="Județ domiciliu *" labelOras="Oraș / Comună *"
                  />
                  <div className="form-row">
                    <div className="form-group">
                      <label>Stradă *</label>
                      <input type="text" className={`form-input${erori.strada ? ' error' : ''}`}
                        placeholder="ex: Bd. Unirii" value={form.strada} onChange={set('strada')} />
                      {erori.strada && <p className="form-error">{erori.strada}</p>}
                    </div>
                    <div className="form-group">
                      <label>Număr *</label>
                      <input type="text" className={`form-input${erori.numar ? ' error' : ''}`}
                        placeholder="ex: 10, bl. A, ap. 5" value={form.numar} onChange={set('numar')} />
                      {erori.numar && <p className="form-error">{erori.numar}</p>}
                    </div>
                  </div>
                </>
              )}

              {/* ── CÂMPURI SPECIFICE: FUNCȚIONAR ── */}
              {tipCont === 'funcționar' && (
                <>
                  <div className="form-group">
                    <label>Instituție *</label>
                    <select
                      className={`form-input${erori.institutie ? ' error' : ''}`}
                      value={form.institutie}
                      onChange={(e) => setInstitutie(e.target.value)}
                    >
                      <option value="">Alege instituția...</option>
                      {INSTITUTII.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                    {erori.institutie && <p className="form-error">{erori.institutie}</p>}
                  </div>

                  <div className="form-group">
                    <label>Departament *</label>
                    <select
                      className={`form-input${erori.departament ? ' error' : ''}`}
                      value={form.departament}
                      onChange={set('departament')}
                      disabled={!form.institutie}
                    >
                      <option value="">{form.institutie ? 'Alege departamentul...' : 'Alege mai întâi instituția'}</option>
                      {departamenteDisponibile.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {erori.departament && <p className="form-error">{erori.departament}</p>}
                  </div>

                  <JudetOrasSelect
                    judet={form.judet} oras={form.oras}
                    onJudetChange={setJudet} onOrasChange={setOras}
                    eroriJudet={erori.judet} eroriOras={erori.oras}
                    labelJudet="Județ instituție *" labelOras="Oraș instituție *"
                  />
                </>
              )}

              {/* ── CÂMPURI SPECIFICE: MEDIC ── */}
              {tipCont === 'medic' && (
                <>
                  <div className="form-group">
                    <label>Specialitate Medicală *</label>
                    <select
                      className={`form-input${erori.specialitate ? ' error' : ''}`}
                      value={form.specialitate} onChange={set('specialitate')}
                    >
                      <option value="">Alege specialitatea...</option>
                      {SPECIALITATI.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {erori.specialitate && <p className="form-error">{erori.specialitate}</p>}
                  </div>

                  <JudetOrasSelect
                    judet={form.judet} oras={form.oras}
                    onJudetChange={setJudet} onOrasChange={setOras}
                    eroriJudet={erori.judet} eroriOras={erori.oras}
                    labelJudet="Județ practică *" labelOras="Oraș practică *"
                  />
                </>
              )}

              {/* Telefon — comun tuturor */}
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

          {/* ── PASUL 1: Cont & Parolă ── */}
          {step === 1 && (
            <>
              <div className="form-group">
                <label>Adresă email *</label>
                <input type="email" className={`form-input${erori.email ? ' error' : ''}`}
                  placeholder="email@exemplu.ro" value={form.email} onChange={set('email')} autoFocus />
                {erori.email && <p className="form-error">{erori.email}</p>}
                <p className="form-hint">📧 Veți primi un cod de verificare pe această adresă.</p>
              </div>

              <div className="form-group">
                <label>Parolă *</label>
                <input type="password" className={`form-input${erori.parola ? ' error' : ''}`}
                  placeholder="Minim 8 caractere" value={form.parola} onChange={set('parola')} />
                {erori.parola && <p className="form-error">{erori.parola}</p>}
                {form.parola && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {passwordChecks.map(([ok, label]) => (
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
                  {loading ? '⏳ Se creează contul...' : 'Creează cont →'}
                </button>
              </div>
            </>
          )}

          {/* ── PASUL 2: Verificare cod email ── */}
          {step === 2 && (
            <>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
                Am trimis un cod de 6 cifre pe adresa dvs. de email. Introduceți-l mai jos pentru a activa contul.
              </p>
              <div className="form-group">
                <label>Cod de verificare *</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} autoFocus
                  className={`form-input${erori.cod ? ' error' : ''}`}
                  placeholder="• • • • • •"
                  value={codEmail}
                  onChange={(e) => setCodEmail(e.target.value.replace(/\D/g, ''))}
                  style={{ fontFamily: 'DM Mono, monospace', letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                />
                {erori.cod && <p className="form-error">{erori.cod}</p>}
              </div>

              <button className="btn btn-primary btn-full" onClick={handleVerifica} disabled={loading}>
                {loading ? '⏳ Se verifică...' : 'Activează contul'}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                style={{ marginTop: 10 }}
                onClick={retrimite}
                disabled={countdown > 0 || resending}
              >
                {resending ? '⏳ Se trimite...' : countdown > 0 ? `Retrimite cod (${countdown}s)` : '🔄 Nu ați primit codul? Retrimiteți'}
              </button>
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

      {/* ── Panoul dreapta ── */}
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
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.06)', borderRadius: 8,
                padding: '10px 14px', textAlign: 'left',
              }}>
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