import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

// ── Icoane ──────────────────────────────────────────
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
  plasament: 'Plasament familial', alocatie: 'Alocație',
  evaluare_adulti: 'Evaluare adulți', alte_servicii: 'Alte servicii',
};

// ── Componente mici ──────────────────────────────────
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

// ── Dashboard ────────────────────────────────────────
export default function Dashboard() {
  const { utilizator } = useAuth();
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

  // Închide panoul la click outside
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
      } else {
        const { data } = await api.get('/dosare');
        setDosare(data);
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

  // ── Statistici ──────────────────────────────────────
  const stats = rol === 'medic' ? {
    total:     dosare.length,
    active:    dosare.filter((d) => d.status !== 'finalizat').length,
    aprobate:  dosare.filter((d) => d.status === 'finalizat').length,
    urgente:   0, // Solicitările medicale nu folosesc neapărat câmpul urgent în listă
    incomplet: 0,
  } : {
    total:     dosare.length,
    active:    dosare.filter((d) => ['depus','in_analiza','incomplet','programat_comisie'].includes(d.status)).length,
    aprobate:  dosare.filter((d) => d.status === 'aprobat').length,
    urgente:   dosare.filter((d) => d.prioritate === 'urgent').length,
    incomplet: dosare.filter((d) => d.status === 'incomplet').length,
  };

  const necitite = notificari.filter((n) => !n.citita).length;
  const dosareRecente = [...dosare].sort((a, b) => new Date(b.creat_la) - new Date(a.creat_la)).slice(0, 8);

  if (loading) return (
    <Layout title="Panou principal">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
      </div>
    </Layout>
  );

  return (
    <Layout title="Panou principal">
      {/* ── Header salut ── */}
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
          {/* Buton notificări */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button className="notif-btn" onClick={() => setShowNotif((v) => !v)}>
              <Ico path="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 01-3.46 0" size={20} />
              {necitite > 0 && <span className="dot" />}
            </button>
            {showNotif && (
              <NotifPanel notificari={notificari} onClose={() => setShowNotif(false)} onMarkAll={markAllRead} />
            )}
          </div>

          {/* CTA principal */}
          {rol === 'cetățean' && (
            <Link to="/dosar/nou" className="btn btn-primary">
              <Ico path="M12 5v14|M5 12h14" size={15} />
              Dosar nou
            </Link>
          )}
        </div>
      </div>

      {/* ── Statistici ── */}
      <div className="stats-grid">
        <StatCard
          icon={<Ico path="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />}
          iconClass="blue" value={stats.total} label="Total dosare"
        />
        <StatCard
          icon={<Ico path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />}
          iconClass="teal" value={stats.active} label="Dosare active"
        />
        <StatCard
          icon={<Ico path="M22 11.08V12a10 10 0 11-5.93-9.14|M22 4L12 14.01l-3-3" />}
          iconClass="green" value={stats.aprobate} label="Aprobate"
        />
        <StatCard
          icon={<Ico path="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01" />}
          iconClass="warn" value={stats.urgente} label="Urgente"
        />
        {(rol === 'funcționar' || rol === 'manager') && (
          <StatCard
            icon={<Ico path="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01" />}
            iconClass="red" value={stats.incomplet} label="Necesită completări"
          />
        )}
      </div>

      {/* ── Acțiuni rapide (cetățean) ── */}
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
              { to: '/dosar/nou', icon: '📋', label: 'Depune dosar nou', color: 'var(--blue-pale)', border: 'var(--blue)' },
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

      {/* ── Dosare recente ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              {rol === 'cetățean' ? 'Dosarele mele recente' : 'Dosare alocate recent'}
            </div>
            <div className="card-subtitle">{dosare.length} dosare în total</div>
          </div>
          <Link to="/dosare" className="btn btn-secondary btn-sm">
            Vezi toate →
          </Link>
        </div>

        {dosareRecente.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <h3>Niciun dosar {rol === 'cetățean' ? 'depus' : 'alocat'} încă</h3>
            {rol === 'cetățean' && (
              <p>
                <Link to="/dosar/nou" className="text-link">Depuneți primul dosar →</Link>
              </p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nr. dosar</th>
                  <th>Tip</th>
                  {rol !== 'cetățean' && <th>{rol === 'medic' ? 'Pacient' : 'Cetățean'}</th>}
                  {rol !== 'medic' && <th>Prioritate</th>}
                  <th>Status</th>
                  <th>{rol === 'medic' ? 'Data solicitării' : 'Data depunerii'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dosareRecente.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>
                        {rol === 'medic' ? (d.dosar?.numar_dosar || `#${d.dosar_id}`) : d.numar_dosar}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{rol === 'medic' ? d.tip : (TIP_LABEL[d.tip] || d.tip)}</td>
                    
                    {rol !== 'cetățean' && (
                      <td style={{ fontSize: 13 }}>
                        {d.cetatean?.prenume} {d.cetatean?.nume}
                      </td>
                    )}

                    {rol !== 'medic' && (
                      <td>
                        {d.prioritate === 'urgent'
                          ? <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>🔴 Urgent</span>
                          : <span style={{ background: 'var(--bg)', color: 'var(--text-3)', padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 500 }}>Normal</span>
                        }
                      </td>
                    )}

                    <td>
                      {rol === 'medic' ? (
                        <span className={`badge badge-${d.status === 'finalizat' ? 'aprobat' : 'incomplet'}`}>
                          {d.status === 'finalizat' ? '✅ Finalizat' : '⏳ În așteptare'}
                        </span>
                      ) : (
                        <span className={`badge badge-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                      {new Date(rol === 'medic' ? d.createdAt : d.creat_la).toLocaleDateString('ro-RO')}
                    </td>
                    <td>
                      <Link to={`/dosar/${rol === 'medic' ? d.dosar_id : d.id}`} className="btn btn-ghost btn-sm">
                        Detalii
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}