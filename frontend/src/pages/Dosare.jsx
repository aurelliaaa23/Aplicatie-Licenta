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
  const [dosare, setDosare]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cautare, setCautare]   = useState('');
  const [filtrStatus, setFiltrStatus] = useState('');
  const [filtrTip, setFiltrTip]       = useState('');
  const [filtrPrioritate, setFiltrPrioritate] = useState('');

  const isMedic = utilizator?.rol === 'medic';

  useEffect(() => {
    // Dacă e medic, aducem lista lui de solicitări. Dacă nu, aducem dosarele normale.
    if (isMedic) {
      api.get('/dosare/medici/solicitari')
        .then(({ data }) => setDosare(data))
        .finally(() => setLoading(false));
    } else {
      api.get('/dosare')
        .then(({ data }) => setDosare(data))
        .finally(() => setLoading(false));
    }
  }, [isMedic]);

  const filtrate = dosare.filter((d) => {
    const text = cautare.toLowerCase();
    if (isMedic) {
      // Filtrare specifică pentru structura solicitărilor medicale
      const matchCautare = !text ||
        d.dosar?.numar_dosar?.toLowerCase().includes(text) ||
        d.cetatean?.nume?.toLowerCase().includes(text) ||
        d.cetatean?.prenume?.toLowerCase().includes(text);
      const matchStatus = !filtrStatus || (filtrStatus === 'incomplet' ? d.status === 'in_asteptare' : d.status === 'finalizat');
      return matchCautare && matchStatus;
    } else {
      // Filtrare originală
      const matchCautare = !text ||
        d.numar_dosar?.toLowerCase().includes(text) ||
        d.cetățean?.nume?.toLowerCase().includes(text) ||
        d.cetățean?.prenume?.toLowerCase().includes(text) ||
        TIP_LABEL[d.tip]?.toLowerCase().includes(text);
      const matchStatus     = !filtrStatus     || d.status === filtrStatus;
      const matchTip        = !filtrTip        || d.tip === filtrTip;
      const matchPrioritate = !filtrPrioritate || d.prioritate === filtrPrioritate;
      return matchCautare && matchStatus && matchTip && matchPrioritate;
    }
  });

  const resetFiltru = () => { setCautare(''); setFiltrStatus(''); setFiltrTip(''); setFiltrPrioritate(''); };

  return (
    <Layout title={isMedic ? "Solicitări Medicale" : "Dosare"}>
      <div className="page-header">
        <h2>
          {isMedic ? 'Solicitări documente medicale' : (utilizator?.rol === 'cetățean' ? 'Dosarele mele' : 'Dosare alocate')}
        </h2>
        <p>{dosare.length} {isMedic ? 'solicitări' : 'dosare'} în total · {filtrate.length} afișate</p>
      </div>

      {/* ── Filtre ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMedic ? '1fr auto auto' : '1fr auto auto auto auto', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Caută</label>
            <input type="text" className="form-input"
              placeholder={isMedic ? "Nr. dosar, nume pacient..." : "Nr. dosar, nume cetățean..."} value={cautare}
              onChange={(e) => setCautare(e.target.value)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Status</label>
            <select className="form-select" value={filtrStatus} onChange={(e) => setFiltrStatus(e.target.value)}>
              <option value="">Toate statusurile</option>
              {isMedic ? (
                <>
                  <option value="incomplet">În așteptare</option>
                  <option value="aprobat">Finalizate</option>
                </>
              ) : (
                Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)
              )}
            </select>
          </div>

          {!isMedic && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tip dosar</label>
                <select className="form-select" value={filtrTip} onChange={(e) => setFiltrTip(e.target.value)}>
                  <option value="">Toate tipurile</option>
                  {Object.entries(TIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Prioritate</label>
                <select className="form-select" value={filtrPrioritate} onChange={(e) => setFiltrPrioritate(e.target.value)}>
                  <option value="">Toate</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </>
          )}

          <button className="btn btn-ghost" onClick={resetFiltru} style={{ marginBottom: 0 }}>
            ✕ Resetează
          </button>
        </div>
      </div>

      {/* ── Tabel dosare ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 50, textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto', width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
          </div>
        ) : filtrate.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <h3>Nu s-a găsit nicio înregistrare</h3>
            <p>Modificați criteriile de filtrare sau <button onClick={resetFiltru} className="text-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>resetați filtrele</button></p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nr. dosar</th>
                  {isMedic ? <th>Tip solicitare</th> : <th>Tip</th>}
                  <th>{isMedic ? 'Pacient' : (utilizator?.rol !== 'cetățean' ? 'Cetățean' : '')}</th>
                  {!isMedic && <th>Departament</th>}
                  {!isMedic && <th>Prioritate</th>}
                  <th>Status</th>
                  <th>{isMedic ? 'Data solicitării' : 'Data depunerii'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrate.map((d) => isMedic ? (
                  /* ── RÂND TABEL MEDIC ── */
                  <tr key={d.id}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>
                        {d.dosar?.numar_dosar || `#${d.dosar_id}`}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{d.tip}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {d.cetatean?.prenume} {d.cetatean?.nume}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{d.cetatean?.email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${d.status === 'finalizat' ? 'aprobat' : 'incomplet'}`}>
                        {d.status === 'finalizat' ? '✅ Finalizat' : '⏳ În așteptare'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                      {new Date(d.createdAt || d.creat_la).toLocaleDateString('ro-RO')}
                    </td>
                    <td>
                      <Link to={`/dosar/${d.dosar_id}`} state={{ solicitare: d }} className={`btn btn-sm ${d.status === 'finalizat' ? 'btn-ghost' : 'btn-primary'}`}>
                        {d.status === 'finalizat' ? 'Vezi dosar' : '📝 Completează'}
                      </Link>
                    </td>
                  </tr>
                ) : (
                  /* ── RÂND TABEL NORMAL ── */
                  <tr key={d.id}>
                    <td>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>
                        {d.numar_dosar}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{TIP_LABEL[d.tip] || d.tip}</td>
                    {utilizator?.rol !== 'cetățean' && (
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {d.cetățean?.prenume} {d.cetățean?.nume}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{d.cetățean?.email}</div>
                      </td>
                    )}
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{d.departament || '—'}</td>
                    <td>
                      {d.prioritate === 'urgent'
                        ? <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>🔴 Urgent</span>
                        : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Normal</span>
                      }
                    </td>
                    <td>
                      <span className={`badge badge-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                      {new Date(d.creat_la).toLocaleDateString('ro-RO')}
                    </td>
                    <td>
                      <Link to={`/dosar/${d.id}`} className="btn btn-secondary btn-sm">
                        Deschide
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {utilizator?.rol === 'cetățean' && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Link to="/dosar/nou" className="btn btn-primary">
            + Dosar nou
          </Link>
        </div>
      )}
    </Layout>
  );
}