import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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
  const isReprezentant = rol === 'reprezentant_școală';
  const isPrimarie     = rol === 'funcționar_primărie';
  const isPolitie      = rol === 'funcționar_poliție';
  const isColaborator  = isMedic || isReprezentant;

  const deptUser    = (utilizator?.profilFunctionar?.departament || utilizator?.departament || '').toLowerCase();
  const isEvidenta  = deptUser.includes('evidenț') || deptUser.includes('evident') || deptUser.includes('persoane');

  useEffect(() => {
    if (isColaborator) {
      const endpoint = isMedic ? '/dosare/medici/solicitari' : '/dosare/reprezentant/solicitari';
      api.get(endpoint)
        .then(({ data }) => setSolicitari(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      api.get('/dosare')
        .then(({ data }) => {
           if (isPrimarie) {
              setDosare(data.filter(d => ['certificat_handicap', 'adoptie'].includes(d.tip)));
           } else if (isPolitie) {
              setDosare(data.filter(d => d.tip === 'adoptie'));
           } else {
              setDosare(data);
           }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isColaborator, isMedic, isPrimarie]);

  const resetFiltru = () => {
    setCautare(''); setFiltrStatus(''); setFiltrTip(''); setFiltrPrioritate('');
  };

  const filtrateDosare = dosare.filter((d) => {
    const text = cautare.toLowerCase();
    const cetateanObj = d.cetatean || d.Utilizator;
    const matchCautare = !text || 
      d.numar_dosar?.toLowerCase().includes(text) ||
      cetateanObj?.nume?.toLowerCase().includes(text) ||
      cetateanObj?.prenume?.toLowerCase().includes(text) ||
      TIP_LABEL[d.tip]?.toLowerCase().includes(text);

    const matchStatus     = !filtrStatus     || d.status === filtrStatus;
    const matchTip        = !filtrTip        || d.tip === filtrTip;
    const matchPrioritate = !filtrPrioritate || d.prioritate === filtrPrioritate;

    return matchCautare && matchStatus && matchTip && matchPrioritate;
  });

  const filtrateSolicitari = solicitari.filter((s) => {
    const text = cautare.toLowerCase();
    const dosarObj = s.dosar || s.Dosar;
    const cetateanObj = s.cetatean || s.Utilizator;
    return !text || 
      dosarObj?.numar_dosar?.toLowerCase().includes(text) ||
      cetateanObj?.nume?.toLowerCase().includes(text) ||
      cetateanObj?.prenume?.toLowerCase().includes(text);
  });

  const titluPagina = isMedic ? 'Solicitări Medicale' 
                    : isReprezentant ? 'Solicitări Adeverințe Școlare'
                    : isPrimarie ? 'Dosare pentru Anchetă Socială' 
                    : 'Dosare DGASPC';

  const subtitlu = isColaborator
    ? `${solicitari.length} solicitări | ${filtrateSolicitari.length} afișate`
    : `${dosare.length} dosare | ${filtrateDosare.length} afișate`;

  const afiseazaData = (dataStr1, dataStr2) => {
    const d = dataStr1 || dataStr2;
    if (!d) return '-';
    const dateObj = new Date(d);
    return isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('ro-RO');
  };

  const solicitariUnice = filtrateSolicitari.reduce((acc, s) => {
  if (!acc.find(x => x.dosar_id === s.dosar_id)) acc.push(s);
  return acc;
}, []);

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
              placeholder={isColaborator ? 'Nr. dosar, nume copil/pacient...' : 'Nr. dosar, nume cetățean...'}
              value={cautare} onChange={(e) => setCautare(e.target.value)} />
          </div>

          {!isColaborator && !isPrimarie && (
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
            <div className="loading-spinner" style={{ margin: '0 auto', width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
          </div>
        ) : isColaborator ? (
          filtrateSolicitari.length === 0 ? (
            <div className="empty-state">
              <h3>Nicio solicitare de completat</h3>
              <p>Nu aveți solicitări active în acest moment.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nr. dosar</th>
                    <th>Cetățean / Copil</th>
                    <th>Tip solicitare</th>
                    <th>Status Solicitare</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
        
                  {solicitariUnice.map((s) => {
                    const dosarObj = s.dosar || s.Dosar || {};
                    const cetateanObj = s.cetatean || s.Utilizator || {};
                    return (
                      <tr key={s.id}>
                        <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>{dosarObj?.numar_dosar || `#${s.dosar_id}`}</span></td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{cetateanObj?.prenume} {cetateanObj?.nume}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{cetateanObj?.email}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <strong>{TIP_LABEL[dosarObj.tip] || dosarObj.tip || 'Dosar'}</strong><br/>
                          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.observatii || (isReprezentant ? 'Adeverință școlară' : 'Referat medical')}</span>
                        </td>
                        <td><span className={`badge badge-${s.status === 'finalizata' || s.status === 'finalizat' ? 'aprobat' : 'incomplet'}`}>{s.status === 'finalizata' || s.status === 'finalizat' ? '✅ Completat' : 'În așteptare'}</span></td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{afiseazaData(s.creat_la, s.createdAt)}</td>
                        <td>
                          <Link to={`/dosar/${s.dosar_id}`} className={`btn btn-sm ${s.status === 'finalizata' || s.status === 'finalizat' ? 'btn-ghost' : 'btn-primary'}`}>
                            {s.status === 'finalizata' || s.status === 'finalizat' ? 'Vezi dosar' : '✏️ Completează'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : isPrimarie ? (
          filtrateDosare.length === 0 ? (
            <div className="empty-state">
              <h3>Niciun dosar în localitate</h3>
              <p>Nu există dosare depuse de cetățeni din orașul dumneavoastră care să necesite anchetă.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nr. dosar</th>
                    <th>Cetățean</th>
                    <th>Tip cerere</th>
                    <th>Status Solicitare</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrateDosare.map((d) => {
                    const cetateanObj = d.cetatean || d.Utilizator || {};
                    const docsDosar = d.Documents || d.documente || d.Documente || [];
                    // La adopție, fiecare departament are un task DISTINCT — nu trebuie amestecate.
                    // Evidența Persoanelor are task propriu doar la adopție; la handicap nu are nimic de făcut.
                    const areAncheta = (d.tip === 'adoptie' && isEvidenta)
                      ? docsDosar.some(doc => doc.nume_fisier && doc.nume_fisier.includes('Domiciliu'))
                      : docsDosar.some(doc => doc.tip_document === 'ancheta_sociala');
                    
                    return (
                      <tr key={d.id}>
                        <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>{d.numar_dosar}</span></td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{cetateanObj?.prenume} {cetateanObj?.nume}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>CNP: {cetateanObj?.cnp || 'Nespecificat'}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          <strong>{TIP_LABEL[d.tip] || d.tip || '-'}</strong><br/>
                          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Anchetă Socială</span>
                        </td>
                        <td><span className={`badge badge-${areAncheta ? 'aprobat' : 'incomplet'}`}>{areAncheta ? '✅ Completat' : 'În așteptare'}</span></td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{afiseazaData(d.creat_la, d.createdAt)}</td>
                        <td>
                          <Link to={`/dosar/${d.id}`} className={`btn btn-sm ${areAncheta ? 'btn-ghost' : 'btn-primary'}`}>
                            {areAncheta ? 'Vezi dosar' : '✏️ Completează'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filtrateDosare.length === 0 ? (
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
                    <th>Tip</th>
                    {rol !== 'cetățean' && <th>Cetățean</th>}
                    <th>Prioritate</th>
                    <th>Status</th>
                    <th>Data depunerii</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrateDosare.map((d) => {
                    const cetateanObj = d.cetatean || d.Utilizator || {};
                    return (
                      <tr key={d.id}>
                        <td><span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: 'var(--blue)', fontWeight: 500 }}>{d.numar_dosar}</span></td>
                        <td style={{ fontSize: 13 }}>{TIP_LABEL[d.tip] || d.tip || '-'}</td>
                        {rol !== 'cetățean' && (
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{cetateanObj?.prenume} {cetateanObj?.nume}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{cetateanObj?.oras || cetateanObj?.judet || ''}</div>
                          </td>
                        )}
                        <td><span className={`badge badge-${d.prioritate === 'urgent' ? 'danger' : 'default'}`}>{d.prioritate === 'urgent' ? '🔴 Urgent' : '🟢 Normal'}</span></td>
                        <td><span className={`badge badge-${d.status}`}>{STATUS_LABEL[d.status] || d.status}</span></td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{afiseazaData(d.creat_la, d.createdAt)}</td>
                        <td>
                          <Link to={`/dosar/${d.id}`} className="btn btn-sm btn-primary">Vezi →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}