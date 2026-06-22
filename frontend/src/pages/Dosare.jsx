import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

export default function Dosare() {
  const { utilizator } = useAuth();
  const [dosare, setDosare]         = useState([]);
  const [solicitari, setSolicitari] = useState([]);
  const [loading, setLoading]       = useState(true);
  
  const [cautare, setCautare]       = useState('');
  const [filtrStatus, setFiltrStatus]       = useState('');
  const [filtrTip, setFiltrTip]             = useState('');
  const [filtrPrioritate, setFiltrPrioritate] = useState('');

  const rol            = utilizator?.rol;
  const isMedic        = rol === 'medic';
  const isPrimarie     = rol === 'funcționar_primărie';

  useEffect(() => {
    if (isMedic) {
      api.get('/dosare/medici/solicitari')
        .then(({ data }) => setSolicitari(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      api.get('/dosare')
        .then(({ data }) => setDosare(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isMedic]);

  const resetFiltru = () => {
    setCautare(''); setFiltrStatus(''); setFiltrTip(''); setFiltrPrioritate('');
  };

  const filtrateDosare = dosare.filter((d) => {
    const text = cautare.toLowerCase();
    const matchCautare = !text ||
      d.numar_dosar?.toLowerCase().includes(text) ||
      d.cetatean?.nume?.toLowerCase().includes(text) ||
      d.cetatean?.prenume?.toLowerCase().includes(text) ||
      TIP_LABEL[d.tip]?.toLowerCase().includes(text);

    const matchStatus     = !filtrStatus     || d.status === filtrStatus;
    const matchTip        = !filtrTip        || d.tip === filtrTip;
    const matchPrioritate = !filtrPrioritate || d.prioritate === filtrPrioritate;

    return matchCautare && matchStatus && matchTip && matchPrioritate;
  });

  const filtrateSolicitari = solicitari.filter((s) => {
    const text = cautare.toLowerCase();
    return !text ||
      s.dosar?.numar_dosar?.toLowerCase().includes(text) ||
      s.cetatean?.nume?.toLowerCase().includes(text) ||
      s.cetatean?.prenume?.toLowerCase().includes(text);
  });

  const titluPagina = isMedic 
    ? 'Solicitări Medicale' 
    : isPrimarie 
      ? 'Dosare pentru anchetă socială' 
      : 'Dosare';

  const subtitlu = isMedic
    ? `${solicitari.length} solicitări · ${filtrateSolicitari.length} afișate`
    : `${dosare.length} dosare · ${filtrateDosare.length} afișate`;

  return (
    <Layout title={titluPagina}>
      <div className="page-header">
        <h2>{titluPagina}</h2>
        <p>{subtitlu}</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, marginBottom: 0, minWidth: 180 }}>
            <label>Caută</label>
            <input type="text" className="form-input"
              placeholder={isMedic ? 'Nr. dosar, nume pacient...' : 'Nr. dosar, nume cetățean...'}
              value={cautare} onChange={(e) => setCautare(e.target.value)} />
          </div>

          {!isMedic && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <select className="form-select" value={filtrStatus}
                  onChange={(e) => setFiltrStatus(e.target.value)}>
                  <option value="">Toate</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) =>
                    <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tip dosar</label>
                <select className="form-select" value={filtrTip}
                  onChange={(e) => setFiltrTip(e.target.value)}>
                  <option value="">Toate</option>
                  {Object.entries(TIP_LABEL).map(([k, v]) =>
                    <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Prioritate</label>
                <select className="form-select" value={filtrPrioritate}
                  onChange={(e) => setFiltrPrioritate(e.target.value)}>
                  <option value="">Toate</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </>
          )}
          <button className="btn btn-ghost" onClick={resetFiltru}>✖ Resetează</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 50, textAlign: 'center' }}>
            <div className="loading-spinner"
              style={{ margin: '0 auto', width: 32, height: 32,
                borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
          </div>
        ) : isMedic ? (
          filtrateSolicitari.length === 0 ? (
            <div className="empty-state">
              <h3>Nicio solicitare medicală</h3>
              <p>Nu aveți solicitări de documente medicale în acest moment.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nr. dosar</th>
                    <th>Pacient</th>
                    <th>Tip solicitare</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrateSolicitari.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5,
                          color: 'var(--blue)', fontWeight: 500 }}>
                          {s.dosar?.numar_dosar || `#${s.dosar_id}`}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {s.cetatean?.prenume} {s.cetatean?.nume}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                          {s.cetatean?.email}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{s.observatii || 'Document medical'}</td>
                      <td>
                        <span className={`badge badge-${s.status === 'finalizata' ? 'aprobat' : 'incomplet'}`}>
                          {s.status === 'finalizata' ? '✓ Finalizat' : '⏳ În așteptare'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                        {new Date(s.creat_la || s.createdAt).toLocaleDateString('ro-RO')}
                      </td>
                      <td>
                        <Link to={`/dosar/${s.dosar_id}`}
                          className={`btn btn-sm ${s.status === 'finalizata' ? 'btn-ghost' : 'btn-primary'}`}>
                          {s.status === 'finalizata' ? 'Vezi dosar' : '✍️ Completează'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filtrateDosare.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              <h3>Nu s-a găsit nicio înregistrare</h3>
              <p>Modificați criteriile de filtrare sau{' '}
                <button onClick={resetFiltru} className="text-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  resetați filtrele
                </button>
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nr. dosar</th>
                    <th>Tip</th>
                    {rol !== 'cetățean' && <th>Cetățean</th>}
                    <th>Prioritate</th>
                    <th>Status</th>
                    <th>Data depunerii</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrateDosare.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5,
                          color: 'var(--blue)', fontWeight: 500 }}>
                          {d.numar_dosar}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{TIP_LABEL[d.tip] || d.tip}</td>
                      {rol !== 'cetățean' && (
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {d.cetatean?.prenume} {d.cetatean?.nume}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                            {d.cetatean?.oras || d.cetatean?.judet || ''}
                          </div>
                        </td>
                      )}
                      <td>
                        <span className={`badge badge-${d.prioritate === 'urgent' ? 'danger' : 'default'}`}>
                          {d.prioritate === 'urgent' ? '🔴 Urgent' : '🔵 Normal'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${d.status}`}>
                          {STATUS_LABEL[d.status] || d.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                        {new Date(d.creat_la).toLocaleDateString('ro-RO')}
                      </td>
                      <td>
                        <Link to={`/dosar/${d.id}`} className="btn btn-sm btn-primary">
                          Vezi ➡️
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}