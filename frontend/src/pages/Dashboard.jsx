import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import StatisticiAdmin from './StatisticiAdmin';

function Ico({ path, size = 20, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {path.split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const STATUS_LABEL = {
  depus: 'Depus', in_analiza: 'În analiză', incomplet: 'Incomplet',
  programat_comisie: 'Programat comisie', aprobat: 'Aprobat',
  respins: 'Respins', arhivat: 'Arhivat',
};

const TIP_LABEL = {
  certificat_handicap: 'Certificat handicap', adoptie: 'Adopție',
  plasament: 'Plasament familial', alocatie: 'Alocație de stat',
  indemnizatie: 'Indemnizație creștere copil', evaluare_adulti: 'Evaluare adulți', alte_servicii: 'Alte servicii',
};

function StatCard({ icon, iconClass, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function NotifPanel({ notificari, onClose, onMarkAll }) {
  return (
    <div className="notif-panel">
      <div className="notif-header">
        <h4>Notificări</h4>
        <button className="btn btn-ghost btn-sm" onClick={onMarkAll}>Marchează toate citite</button>
      </div>
      <div className="notif-list">
        {notificari.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Nicio notificare nouă
          </div>
        ) : notificari.map((n) => (
          <div key={n.id} className={`notif-item${!n.citita ? ' unread' : ''}`}>
            <div className="notif-title">{n.titlu}</div>
            <div className="notif-msg">{n.mesaj}</div>
            <div className="notif-time">{new Date(n.creat_la).toLocaleString('ro-RO')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { utilizator } = useAuth();
  const rolPrecoce = utilizator?.rol;

  // Administratorul are un panou complet separat, cu statistici — nu lista de dosare.
  if (rolPrecoce === 'administrator') {
    return (
      <Layout title="Panou principal">
        <StatisticiAdmin />
      </Layout>
    );
  }

  const [dosare, setDosare]         = useState([]);
  const [notificari, setNotificari] = useState([]);
  const [showNotif, setShowNotif]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const notifRef = useRef();
  const rol = utilizator?.rol;

  useSocket(utilizator?.id, () => {
    fetchNotificari();
  });

  useEffect(() => {
    Promise.all([fetchDosare(), fetchNotificari()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchDosare = async () => {
    try {
      if (rol === 'medic') {
        const { data } = await api.get('/dosare/medici/solicitari');
        setDosare(data);
      } else if (rol === 'reprezentant_școală') {
        const { data } = await api.get('/dosare/reprezentant/solicitari');
        setDosare(data);
      } else if (rol === 'funcționar_poliție') {
        const { data } = await api.get('/dosare/politie/solicitari');
        setDosare(data);
      } else {
        const { data } = await api.get('/dosare');
        
        if (rol === 'funcționar_primărie') {
          const tipuriPermise = isEvidentaPrimarie ? ['adoptie'] : ['certificat_handicap', 'adoptie'];
          setDosare(data.filter(d => tipuriPermise.includes(d.tip)));
        } else {
          // Restul (Cetățean, Funcționar DGASPC, Manager etc.) văd dosarele lor conform backend-ului
          setDosare(data);
        }
      }
    } catch {}
  };

  const fetchNotificari = async () => {
    try {
      const { data } = await api.get('/notificari');
      setNotificari(data);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notificari/mark-all-read');
      setNotificari((n) => n.map((x) => ({ ...x, citita: true })));
    } catch {}
  };

  const deptUserDash = (utilizator?.profilFunctionar?.departament || utilizator?.departament || '').toLowerCase();
  const isEvidentaPrimarie = deptUserDash.includes('evidenț') || deptUserDash.includes('evident') || deptUserDash.includes('persoane');

  let stats = { total: dosare.length, active: 0, aprobate: 0, urgente: 0, incomplet: 0, completate: 0, respinse: 0 };

  if (rol === 'medic' || rol === 'reprezentant_școală' || rol === 'funcționar_poliție') {
    stats.active = dosare.filter((d) => d.status !== 'finalizata' && d.status !== 'finalizat').length;
    stats.completate = dosare.filter((d) => d.status === 'finalizata' || d.status === 'finalizat').length;
  } else if (rol === 'funcționar_primărie') {
    const completateCount = dosare.filter(d => {
      const docs = d.Documents || d.documente || d.Documente || [];
      if (d.tip === 'adoptie' && isEvidentaPrimarie) {
        return docs.some(doc => doc.nume_fisier && doc.nume_fisier.includes('Domiciliu'));
      }
      return docs.some(doc => doc.tip_document === 'ancheta_sociala');
    }).length;
    stats.active = dosare.length - completateCount;
    stats.completate = completateCount;
  } else {
    stats.active = dosare.filter((d) => ['depus','in_analiza','incomplet','programat_comisie'].includes(d.status)).length;
    stats.aprobate = dosare.filter((d) => d.status === 'aprobat').length;
    stats.urgente = dosare.filter((d) => d.prioritate === 'urgent').length;
    stats.incomplet = dosare.filter((d) => d.status === 'incomplet').length;
    stats.respinse = dosare.filter((d) => d.status === 'respins').length;
  }

  const necitite = notificari.filter((n) => !n.citita).length;
  const dosareRecente = [...dosare].sort((a, b) => new Date(b.creat_la || b.createdAt || 0) - new Date(a.creat_la || a.createdAt || 0)).slice(0, 8);

  const afiseazaData = (dataStr1, dataStr2) => {
    const d = dataStr1 || dataStr2;
    if (!d) return '-';
    const dateObj = new Date(d);
    return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('ro-RO');
  };

  if (loading) return (
    <Layout title="Panou principal">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
      </div>
    </Layout>
  );

  return (
    <Layout title="Panou principal">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-1)' }}>
            Bună ziua, {utilizator?.prenume}! 👋
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 4 }}>
            {new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button className="notif-btn" onClick={() => setShowNotif((v) => !v)}>
              <Ico path="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 01-3.46 0" size={20} />
              {necitite > 0 && <span className="dot" />}
            </button>
            {showNotif && (
              <NotifPanel notificari={notificari} onClose={() => setShowNotif(false)} onMarkAll={markAllRead} />
            )}
          </div>
          {rol === 'cetățean' && (
            <Link to="/dosar/nou" className="btn btn-primary">
              <Ico path="M12 5v14|M5 12h14" size={15} />
              Dosar nou
            </Link>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={<Ico path="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />} iconClass="blue" value={stats.total} label={['medic', 'reprezentant_școală', 'funcționar_poliție'].includes(rol) ? "Total solicitări" : "Total dosare"} />
        <StatCard icon={<Ico path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />} iconClass="teal" value={stats.active} label="Dosare active" />
        <StatCard icon={<Ico path="M22 11.08V12a10 10 0 11-5.93-9.14|M22 4L12 14.01l-3-3" />} iconClass="green" 
          value={(['medic', 'funcționar_primărie', 'reprezentant_școală', 'funcționar_poliție'].includes(rol)) ? stats.completate : stats.aprobate} 
          label={(['medic', 'funcționar_primărie', 'reprezentant_școală', 'funcționar_poliție'].includes(rol)) ? "Completate" : "Aprobate"} />
        <StatCard icon={<Ico path="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01" />} iconClass="warn" value={stats.urgente} label="Urgente" />
        {(rol === 'funcționar' || rol === 'manager') && (
          <StatCard icon={<Ico path="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01" />} iconClass="red" value={stats.incomplet} label="Necesită completări" />
        )}
        {['cetățean', 'funcționar', 'manager'].includes(rol) && (
          <StatCard icon={<Ico path="M18 6L6 18|M6 6l12 12" />} iconClass="red" value={stats.respinse} label="Dosare respinse" />
        )}
      </div>

      {rol === 'cetățean' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Acțiuni rapide</div>
              <div className="card-subtitle">Ce doriți să faceți astăzi?</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
            {[
              { to: '/dosar/nou', icon: '📝', label: 'Depune dosar nou', color: 'var(--blue-pale)', border: 'var(--blue)' },
              { to: '/dosare', icon: '📂', label: 'Dosarele mele', color: 'var(--teal-pale)', border: 'var(--teal)' },
              { to: '/programari', icon: '📅', label: 'Programările mele', color: 'var(--warning-bg)', border: 'var(--warning)' },
              { to: '/profil', icon: '👤', label: 'Profilul meu', color: '#f8fafc', border: 'var(--border-dark)' },
            ].map(({ to, icon, label, color, border }) => (
              <Link key={to} to={to} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                padding: '20px 14px', borderRadius: 'var(--radius)', textDecoration: 'none',
                background: color, border: `1.5px solid ${border}20`,
                transition: 'transform 0.15s, box-shadow 0.15s',
                cursor: 'pointer',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 28 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', textAlign: 'center' }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              {rol === 'cetățean' ? 'Dosarele mele recente' : 'Solicitări alocate recent'}
            </div>
            <div className="card-subtitle">{dosare.length} înregistrări în total</div>
          </div>
          <Link to="/dosare" className="btn btn-secondary btn-sm">Vezi toate →</Link>
        </div>

        {dosareRecente.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <h3>Nu aveți nicio înregistrare recentă</h3>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nr. dosar</th>
                  <th>Tip</th>
                  {rol !== 'cetățean' && <th>{['medic', 'reprezentant_școală', 'funcționar_poliție'].includes(rol) ? 'Cetățean' : 'Cetățean'}</th>}
                  {!['medic', 'reprezentant_școală', 'funcționar_poliție'].includes(rol) && <th>Prioritate</th>}
                  <th>Status</th>
                  <th>{['medic', 'funcționar_primărie', 'reprezentant_școală', 'funcționar_poliție'].includes(rol) ? 'Data solicitării' : 'Data depunerii'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dosareRecente.map((d) => {
                  const isExternalCollab = ['medic', 'reprezentant_școală', 'funcționar_poliție'].includes(rol);
                  const dosarObj = isExternalCollab ? (d.dosar || d.Dosar || {}) : d;
                  const cetateanObj = d.cetatean || d.Utilizator || {};
                  const esteSot = d.observatii && d.observatii.includes('Soț/Soție');
                  let numeAfisat = `${cetateanObj?.prenume || ''} ${cetateanObj?.nume || ''}`.trim();
                  if (esteSot) {
                    if (d.numePartener) {
                      numeAfisat = d.numePartener;
                    } else if (dosarObj?.descriere && dosarObj.descriere.includes('[Partener:')) {
                      const match = dosarObj.descriere.match(/\[Partener: (.*?), CNP: .*?\]/);
                      if (match) numeAfisat = match[1];
                    }
                  }
                  
                  return (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>
                          {dosarObj.numar_dosar || `#${d.dosar_id || d.id}`}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {TIP_LABEL[dosarObj.tip] || dosarObj.tip || 'Dosar'}
                      </td>
                      {rol !== 'cetățean' && (
                        <td style={{ fontSize: 13 }}>
                          {numeAfisat}
                        </td>
                      )}
                      {!['medic', 'reprezentant_școală', 'funcționar_poliție'].includes(rol) && (
                        <td>
                          {d.prioritate === 'urgent'
                            ? <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>🔴 Urgent</span>
                            : <span style={{ background: 'var(--bg)', color: 'var(--text-3)', padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 500 }}>Normal</span>
                          }
                        </td>
                      )}
                      <td>
                        {isExternalCollab ? (
                          <span className={`badge badge-${d.status === 'finalizata' || d.status === 'finalizat' ? 'aprobat' : 'incomplet'}`}>
                            {d.status === 'finalizata' || d.status === 'finalizat' ? '✅ Completat' : 'În așteptare'}
                          </span>
                        ) : rol === 'funcționar_primărie' ? (() => {
                          const areAncheta = (dosarObj.Documents || dosarObj.documente || dosarObj.Documente || []).some(doc => doc.tip_document === 'ancheta_sociala');
                          return (
                            <span className={`badge badge-${areAncheta ? 'aprobat' : 'incomplet'}`}>
                              {areAncheta ? '✅ Completat' : 'În așteptare'}
                            </span>
                          );
                        })() : (
                          <span className={`badge badge-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                        {afiseazaData(d.creat_la, d.createdAt)}
                      </td>
                      <td>
                     <Link to={`/dosar/${isExternalCollab ? d.dosar_id : d.id}${['funcționar_poliție', 'medic'].includes(rol) ? `?persoana=${esteSot ? 'sot' : 'titular'}` : ''}`} className={`btn btn-sm ${d.status === 'finalizata' || d.status === 'finalizat' ? 'btn-ghost' : 'btn-primary'}`}>
                          Detalii
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}