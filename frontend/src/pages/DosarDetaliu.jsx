import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_OPTIONS = [
  { value: 'in_analiza',         label: '📋 În analiză' },
  { value: 'incomplet',          label: '⚠️ Incomplet — necesită completări' },
  { value: 'programat_comisie',  label: '📅 Programat la comisie' },
  { value: 'aprobat',            label: '✅ Aprobat' },
  { value: 'respins',            label: '❌ Respins' },
  { value: 'arhivat',            label: '🗂 Arhivat' },
];

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

const DOC_TIP_LABEL = {
  carte_identitate: 'Carte identitate', certificat_medical: 'Certificat medical',
  ancheta_sociala: 'Anchetă socială', referat: 'Referat',
  decizie: 'Decizie', semnatura: 'Semnătură electronică', alte: 'Alt document',
};

export default function DosarDetaliu() {
  const { id }      = useParams();
  const { utilizator } = useAuth();
  const navigate    = useNavigate();
  
  const [dosar, setDosar]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus]   = useState('');
  const [motiv, setMotiv]           = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploading, setUploading]   = useState(false);
  
  const fileRef = useRef(null);

  const rol = utilizator?.rol;
  const canEditStatus = ['funcționar', 'manager', 'administrator'].includes(rol);

  useEffect(() => { fetchDosar(); }, [id]);

  const fetchDosar = async () => {
    try {
      const { data } = await api.get(`/dosare/${id}`);
      setDosar(data);
      setNewStatus(data.status);
      setMotiv(data.motiv_respingere || '');
    } catch {
      toast.error('Dosarul nu a putut fi încărcat');
      navigate('/dosare');
    } finally {
      setLoading(false);
    }
  };

  const saveStatus = async () => {
    if (!newStatus) return;
    if (newStatus === 'respins' && !motiv.trim()) {
      toast.warning('Introduceți motivul respingerii');
      return;
    }
    setSavingStatus(true);
    try {
      await api.patch(`/dosare/${id}/status`, {
        status: newStatus,
        motiv_respingere: newStatus === 'respins' ? motiv : null,
      });
      toast.success('Status actualizat cu succes');
      setEditStatus(false);
      fetchDosar();
    } catch (err) {
      toast.error(err.response?.data?.eroare || 'Eroare la actualizare status');
    } finally {
      setSavingStatus(false);
    }
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('fisier', file);
      fd.append('dosar_id', id);
      fd.append('tip_document', 'alte');
      await api.post('/documente/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document adăugat cu succes');
      fetchDosar(); // Reîncarcă lista de documente
    } catch {
      toast.error('Eroare la încărcarea documentului');
    } finally {
      setUploading(false);
    }
  };

  const Timeline = ({ status }) => {
    const all = ['depus', 'in_analiza', 'programat_comisie', 'aprobat'];
    const rejected = ['respins', 'incomplet', 'arhivat'].includes(status);
    const steps = rejected ? ['depus', 'in_analiza', status] : all;
    const idx = steps.indexOf(status);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 28 }}>
        {steps.map((s, i) => {
          const done  = i < idx;
          const active = i === idx;
          return (
            <div key={s} style={{ position: 'relative', paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', left: -21, top: 20, width: 2, height: '100%', background: done ? 'var(--blue)' : 'var(--border)' }} />
              )}
              <div style={{ position: 'absolute', left: -28, top: 2, width: 16, height: 16, borderRadius: '50%', background: active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)', border: '2px solid white', boxShadow: '0 0 0 2px ' + (active ? (rejected && i === idx ? 'var(--danger)' : 'var(--blue)') : done ? 'var(--blue)' : 'var(--border)') }} />
              <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-1)' : done ? 'var(--text-2)' : 'var(--text-3)' }}>
                {STATUS_LABEL[s]}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading || !dosar) return (
    <Layout title="Dosar">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
      </div>
    </Layout>
  );

  // Extragem sigur datele corecte, fără diacritice, conform backend-ului tău
  const cetatean = dosar.cetatean || {};
  const functionar = dosar.functionar || null;
  // Prindem lista de documente indiferent cum a denumit-o Sequelize în spate
  const documenteAtasate = dosar.Documents || dosar.documente || dosar.Documente || [];

  return (
    <Layout title={`Dosar ${dosar.numar_dosar}`}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-2)' }}>
        <button onClick={() => navigate('/dosare')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 13 }}>
          ← Înapoi la dosare
        </button>
        <span>/</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{dosar.numar_dosar}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* ── Coloana stângă ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header dosar */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--blue)', background: 'var(--blue-pale)', padding: '3px 10px', borderRadius: 20 }}>
                    {dosar.numar_dosar}
                  </span>
                  <span className={`badge badge-${dosar.status}`}>{STATUS_LABEL[dosar.status]}</span>
                  {dosar.prioritate === 'urgent' && (
                    <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
                      🔴 Urgent
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
                  {TIP_LABEL[dosar.tip] || dosar.tip}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Departament: {dosar.departament || '—'} · Depus la {new Date(dosar.creat_la).toLocaleDateString('ro-RO')}
                </p>
              </div>

              {canEditStatus && (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditStatus(!editStatus)}>
                  ✏️ Modifică status
                </button>
              )}
            </div>

            {/* Editare status */}
            {editStatus && canEditStatus && (
              <div style={{ marginTop: 20, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label>Noul status</label>
                  <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {newStatus === 'respins' && (
                  <div className="form-group">
                    <label>Motiv respingere *</label>
                    <textarea className="form-textarea" rows={3}
                      placeholder="Explicați motivul respingerii pentru a informa cetățeanul..."
                      value={motiv} onChange={(e) => setMotiv(e.target.value)} />
                  </div>
                )}
                {newStatus === 'incomplet' && (
                  <div className="form-group">
                    <label>Documente / informații lipsă</label>
                    <textarea className="form-textarea" rows={3}
                      placeholder="Specificați ce documente sau informații lipsesc..."
                      value={motiv} onChange={(e) => setMotiv(e.target.value)} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={saveStatus} disabled={savingStatus}>
                    {savingStatus ? <><div className="loading-spinner" /> Se salvează...</> : 'Salvează statusul'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditStatus(false)}>Anulează</button>
                </div>
              </div>
            )}

            {/* Motiv respingere / incomplet */}
            {(dosar.status === 'respins' || dosar.status === 'incomplet') && dosar.motiv_respingere && (
              <div style={{ marginTop: 16, background: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>
                  {dosar.status === 'respins' ? '❌ Motiv respingere:' : '⚠️ Informații necesare:'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{dosar.motiv_respingere}</p>
              </div>
            )}
          </div>

          {/* Descriere */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Descrierea situației</div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {dosar.descriere || 'Nicio descriere furnizată.'}
            </p>
          </div>

          {/* Documente */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Documente atașate</div>
                <div className="card-subtitle">{documenteAtasate.length} fișiere atașate la acest dosar</div>
              </div>
              <div>
                <input type="file" ref={fileRef} style={{ display: 'none' }}
                  accept=".pdf,.jpg,.jpeg,.png" onChange={uploadDocument} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳ Se încarcă...' : '+ Adaugă document'}
                </button>
              </div>
            </div>

            {documenteAtasate.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3 style={{ fontSize: 14 }}>Niciun document atașat încă</h3>
              </div>
            ) : (
              <div className="file-list">
                {documenteAtasate.map((doc) => (
                  <div key={doc.id} className="file-item" style={{ alignItems: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    
                    <div style={{ flex: 1, paddingLeft: 8 }}>
                      <div className="file-name" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                        {doc.nume_fisier || DOC_TIP_LABEL[doc.tip_document] || doc.tip_document}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        {new Date(doc.incarcat_la).toLocaleString('ro-RO')}
                      </div>
                    </div>

                    {doc.tip_document === 'semnatura' && doc.semnatura_base64 ? (
                      <span style={{ fontSize: 11, background: 'var(--success-bg)', color: 'var(--success)', padding: '4px 10px', borderRadius: 20 }}>
                        ✍️ Semnătură Olografă
                      </span>
                    ) : doc.cale_fisier ? (
                      <a href={`http://localhost:5000/${doc.cale_fisier.replace(/\\/g, '/')}`}
                        target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        Deschide PDF
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Coloana dreaptă ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status timeline */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Progresul dosarului</div>
            <Timeline status={dosar.status} />
          </div>

          {/* Funcționar */}
          {functionar && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Funcționar alocat</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['👤 Nume', `${functionar.prenume || ''} ${functionar.nume || ''}`],
                  ['🏢 Departament', functionar.departament || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informații dosar */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Detalii dosar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Tip', TIP_LABEL[dosar.tip] || dosar.tip],
                ['Departament', dosar.departament || '—'],
                ['Prioritate', dosar.prioritate === 'urgent' ? '🔴 Urgent' : '⚪ Normal'],
                ['Depus la', new Date(dosar.creat_la).toLocaleDateString('ro-RO')],
                ['Ultima actualizare', new Date(dosar.actualizat_la).toLocaleDateString('ro-RO')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}