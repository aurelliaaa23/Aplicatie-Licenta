import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

moment.locale('ro');
const localizer = momentLocalizer(moment);

const TIP_COMISIE_COLOR = {
  protectia_copilului: '#2563eb',
  adoptii:             '#7c3aed',
  evaluare_adulti:     '#0d9488',
  handicap:            '#d97706',
  certificat_handicap: '#d97706', // Mapare pentru dosare
  adoptie:             '#7c3aed',
  plasament:           '#2563eb',
  alocatie:            '#2563eb',  // ← corectat: era teal, acum albastru (aceeași categorie ca protectia_copilului)
  indemnizatie:        '#2563eb'   // ← adăugat: lipsea complet din hartă
};

const TIP_COMISIE_LABEL = {
  protectia_copilului: 'Protecția copilului',
  adoptii:             'Adopții',
  evaluare_adulti:     'Evaluare adulți',
  handicap:            'Handicap',
  certificat_handicap: 'Handicap',
  adoptie:             'Adopții',
  plasament:           'Protecția copilului',
  alocatie:            'Protecția copilului',
  indemnizatie:        'Protecția copilului',
  alte_servicii:       'General'
};

// Doar categoriile unice, distincte — pentru legendă și pentru dropdown-ul de creare programare.
// (TIP_COMISIE_LABEL/COLOR de mai sus rămân complete, cu alias-uri, pentru căutarea culorii/etichetei
// oricărui tip_comisie sau tip_dosar existent în date.)
const TIP_COMISIE_CANONICE = ['protectia_copilului', 'adoptii', 'evaluare_adulti', 'handicap', 'alte_servicii'];

const messages_ro = {
  today: 'Azi', previous: '◀', next: '▶', month: 'Lună', week: 'Săptămână', day: 'Zi', agenda: 'Agendă',
  showMore: (n) => `+${n} mai multe`, noEventsInRange: 'Nicio programare în această perioadă.'
};

export default function Calendar() {
  const [programari, setProgramari] = useState([]);
  const [events, setEvents]         = useState([]);
  const [view, setView]             = useState('week');
  const [date, setDate]             = useState(new Date());
  const [selected, setSelected]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  
  const [form, setForm] = useState({
    dosar_id: '', tip_comisie: 'protectia_copilului',
    data_ora: '', durata_minute: 30, locatie: '',
  });

  const { utilizator } = useAuth();
  const esteCetatean = utilizator?.rol === 'cetățean';
  
  const location = useLocation();

  useEffect(() => {
    fetchProgramari();
    
    // Dacă am fost redirecționați din pagina DosarDetaliu, deschidem automat formularul!
    if (location.state?.dosar_id) {
      setForm(f => ({
        ...f,
        dosar_id: location.state.dosar_id,
        tip_comisie: location.state.tip_dosar || 'protectia_copilului'
      }));
      setShowForm(true);
      // Curățăm starea pentru a nu se redeschide dacă dăm refresh la pagină
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchProgramari = async () => {
    try {
      const { data } = await api.get('/programari');
      setProgramari(data);
      setEvents(data.map(mapEvent));
    } catch {
      toast.error('Eroare la încărcarea programărilor');
    } finally {
      setLoading(false);
    }
  };

  const mapEvent = (p) => {
    const tipLabel = TIP_COMISIE_LABEL[p.tip_comisie]
      || p.detalii?.replace('Comisie: ', '')
      || 'Programare comisie';
    return {
      id:    p.id,
      title: tipLabel,
      start: new Date(p.data_ora_programare || p.data_ora),
      end:   new Date(new Date(p.data_ora_programare || p.data_ora).getTime() + (p.durata_minute || 60) * 60000),
      resource: p,
      color: TIP_COMISIE_COLOR[p.tip_comisie] || '#2563eb',
    };
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const salveazaProgramare = async () => {
    if (!form.dosar_id || !form.data_ora) {
      toast.warning('Completați câmpurile obligatorii');
      return;
    }
    setSaving(true);
    try {
      await api.post('/programari', form);
      toast.success('Programare salvată cu succes! E-mailul a fost trimis cetățeanului.');
      setShowForm(false);
      setForm({ dosar_id: '', tip_comisie: 'protectia_copilului', data_ora: '', durata_minute: 30, locatie: '' });
      fetchProgramari();
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const anuleazaProgramare = async (id) => {
    try {
      await api.patch(`/programari/${id}/status`, { status: 'anulat' });
      toast.info('Programare anulată');
      setSelected(null);
      fetchProgramari();
    } catch {
      toast.error('Eroare la anulare');
    }
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.color,
      borderRadius: '6px',
      border: 'none',
      color: 'white',
      fontSize: '12px',
      padding: '2px 6px',
    },
  });

  return (
    <Layout title="Calendar comisii">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>{esteCetatean ? 'Programările mele' : 'Calendar comisii'}</h2>
          <p>{esteCetatean ? 'Programările dvs. la comisiile DGASPC' : 'Gestionați programările la comisiile de specialitate DGASPC'}</p>
        </div>
        {!esteCetatean && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Programare nouă
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        {TIP_COMISIE_CANONICE.map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: TIP_COMISIE_COLOR[k] }} />
            {TIP_COMISIE_LABEL[k]}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 310px' : '1fr', gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <BigCalendar
                localizer={localizer}
                events={events}
                view={view} onView={setView}
                date={date} onNavigate={setDate}
                onSelectEvent={(ev) => setSelected(ev.resource)}
                eventPropGetter={eventStyleGetter}
                messages={messages_ro}
                style={{ height: 540 }}
                formats={{
                  dayHeaderFormat: (d) => moment(d).format('ddd D MMM'),
                  agendaHeaderFormat: ({ start, end }) => `${moment(start).format('D MMM')} — ${moment(end).format('D MMM YYYY')}`,
                }}
              />
            </div>
          )}
        </div>

        {selected && (
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-header">
              <div className="card-title">Detalii programare</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18 }}>✖</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'inline-block', background: TIP_COMISIE_COLOR[selected.tip_comisie] || '#2563eb', color: 'white', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                  {TIP_COMISIE_LABEL[selected.tip_comisie] || 'Comisie'}
                </div>
                <span className={`badge badge-${selected.status}`} style={{ marginLeft: 8 }}>
                  {selected.status === 'programat' ? 'Programat' : selected.status === 'realizat' ? 'Realizat' : 'Anulat'}
                </span>
              </div>
              {[
                ['📅 Data și ora', moment(selected.data_ora).format('DD MMMM YYYY, HH:mm')],
                ['📍 Locație & ⏱ Durată', `${selected.detalii} `],
                ['📂 Dosar', selected.Dosar?.numar_dosar || `#${selected.dosar_id}`],
              ].map(([label, val]) => (
                <div key={label} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-1)', fontWeight: 500 }}>{val}</div>
                </div>
              ))}
              {selected.status === 'programat' && !esteCetatean && (
                <button className="btn btn-danger btn-sm" style={{ marginTop: 4 }}
                  onClick={() => anuleazaProgramare(selected.id)}>
                  Anulează programarea
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && !esteCetatean &&(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title">Programare nouă la comisie</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, lineHeight: 1 }}>✖</button>
            </div>
            <div className="form-group">
              <label>ID Dosar (Numeric) *</label>
              <input type="number" className="form-input" placeholder="ex: 42"
                value={form.dosar_id} onChange={set('dosar_id')} />
              <p className="form-hint">Dacă ați venit de pe pagina dosarului, acest câmp s-a completat automat.</p>
            </div>
            <div className="form-group">
              <label>Tip comisie / Dosar *</label>
              <select className="form-select" value={form.tip_comisie} onChange={set('tip_comisie')}>
                {TIP_COMISIE_CANONICE.map((k) => (
                  <option key={k} value={k}>{TIP_COMISIE_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Data și ora *</label>
              <input type="datetime-local" className="form-input"
                value={form.data_ora} onChange={set('data_ora')}
                min={new Date().toISOString().slice(0, 16)} />
            </div>
            <div className="form-group">
              <label>Durată (minute)</label>
              <select className="form-select" value={form.durata_minute} onChange={set('durata_minute')}>
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} minute</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Locație</label>
              <input type="text" className="form-input"
                placeholder="Sediul DGASPC, sala nr. ..."
                value={form.locatie} onChange={set('locatie')} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Anulează</button>
              <button className="btn btn-primary" onClick={salveazaProgramare} disabled={saving}>
                {saving ? <><div className="loading-spinner" /> Se salvează...</> : 'Salvează și trimite E-mail'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}