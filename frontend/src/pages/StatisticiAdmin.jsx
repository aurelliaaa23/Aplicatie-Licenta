import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS_LABEL = {
  depus: 'Depus', in_analiza: 'În analiză', incomplet: 'Incomplet',
  programat_comisie: 'Programat comisie', aprobat: 'Aprobat',
  respins: 'Respins', arhivat: 'Arhivat',
};
const STATUS_COLOR = {
  depus: '#94a3b8', in_analiza: '#2563eb', incomplet: '#d97706',
  programat_comisie: '#7c3aed', aprobat: '#16a34a',
  respins: '#dc2626', arhivat: '#64748b',
};

const TIP_LABEL = {
  certificat_handicap: 'Certificat handicap', adoptie: 'Adopție',
  plasament: 'Plasament familial', alocatie: 'Alocație de stat',
  indemnizatie: 'Indemnizație creștere copil', evaluare_adulti: 'Evaluare adulți',
  alte_servicii: 'Alte servicii',
};
const TIP_COLOR = {
  certificat_handicap: '#d97706', adoptie: '#7c3aed', plasament: '#2563eb',
  alocatie: '#0d9488', indemnizatie: '#0891b2', evaluare_adulti: '#c026d3',
  alte_servicii: '#64748b',
};

const PROGRAMARE_LABEL = { programat: 'Programat', realizat: 'Realizat', anulat: 'Anulat' };
const PROGRAMARE_COLOR = { programat: '#2563eb', realizat: '#16a34a', anulat: '#dc2626' };

const LUNI_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

// Departamentul e text liber în baza de date — normalizăm după cuvinte-cheie, nu potrivire exactă.
function normalizeazaDepartament(dep) {
  const d = (dep || '').toLowerCase();
  if (d.includes('adop')) return 'Adopții';
  if (d.includes('evaluare') || d.includes('adult') || d.includes('handicap')) return 'Evaluare Adulți';
  if (d.includes('protec')) return 'Protecția Copilului';
  if (d.includes('asisten')) return 'Asistență Socială';
  return 'Alt departament';
}

const DEPT_ORDINE = ['Protecția Copilului', 'Adopții', 'Evaluare Adulți', 'Asistență Socială', 'Alt departament'];
const DEPT_COLOR = {
  'Protecția Copilului': '#2563eb', 'Adopții': '#7c3aed',
  'Evaluare Adulți': '#d97706', 'Asistență Socială': '#0d9488', 'Alt departament': '#64748b',
};

function KpiCard({ label, value, sub, color = 'var(--blue)' }) {
  return (
    <div className="card" style={{ padding: '18px 20px', flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Bară orizontală simplă, fără librării — width proporțional cu maximul din serie
function BarListCard({ title, data, labels, colors, total }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="card" style={{ padding: 20, flex: '1 1 380px', minWidth: 320 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Nicio dată disponibilă.</div>}
        {data.map((d) => {
          const key = d.key;
          const pct = total ? Math.round((d.total / total) * 100) : 0;
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{labels[key] || key}</span>
                <span style={{ color: 'var(--text-3)' }}>{d.total} {total ? `(${pct}%)` : ''}</span>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${(d.total / max) * 100}%`, height: '100%', background: colors[key] || 'var(--blue)', borderRadius: 6, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Grafic simplu de tip coloane verticale, pentru trend lunar
function TrendChart({ data }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="card" style={{ padding: 20, flex: '1 1 100%' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>📈 Dosare depuse (ultimele 6 luni)</div>
      {data.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Nicio dată disponibilă.</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 8px' }}>
          {data.map((d) => {
            const [an, luna] = d.luna.split('-');
            const label = LUNI_RO[parseInt(luna, 10) - 1] || luna;
            return (
              <div key={d.luna} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{d.total}</div>
                <div style={{
                  width: '100%', maxWidth: 44,
                  height: `${Math.max((d.total / max) * 110, 4)}px`,
                  background: 'linear-gradient(180deg, var(--blue-light), var(--blue))',
                  borderRadius: '6px 6px 2px 2px', transition: 'height 0.4s ease',
                }} />
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{label} {an}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StatisticiAdmin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('total');

  useEffect(() => {
    api.get('/statistici/admin')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="loading-spinner" style={{ width: 32, height: 32, borderColor: 'var(--border)', borderTopColor: 'var(--blue)' }} />
      </div>
    );
  }

  if (!stats) {
    return <div className="empty-state"><h3>Statisticile nu au putut fi încărcate.</h3></div>;
  }

  const { totaluri, dosarePeStatus, dosarePeTip, dosarePePrioritate, dosarePeFunctionar, programariPeStatus, dosareTrend } = stats;

  const toBarData = (rows, keyName) => rows.map(r => ({ key: r[keyName], total: parseInt(r.total, 10) }));

  const statusData     = toBarData(dosarePeStatus, 'status');
  const tipData         = toBarData(dosarePeTip, 'tip');
  const prioritateData  = toBarData(dosarePePrioritate, 'prioritate').map(d => ({ ...d, key: d.key || 'normal' }));
  const programariData  = toBarData(programariPeStatus, 'status');

  const functionariSortati = [...dosarePeFunctionar].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxFunctionar = Math.max(...dosarePeFunctionar.map(f => f.total), 1);

  const functionariPeDept = {};
  functionariSortati.forEach(f => {
    const dept = normalizeazaDepartament(f.departament);
    if (!functionariPeDept[dept]) functionariPeDept[dept] = [];
    functionariPeDept[dept].push(f);
  });

  const dosarePeCetatean = stats.dosarePeCetatean || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <h2>Panou de management DGASPC</h2>
        <p>Statistici și indicatori la nivelul întregii platforme.</p>
      </div>

      {/* ── KPI-uri principale ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard label="Total dosare" value={totaluri.totalDosare} />
        <KpiCard label="În lucru" value={totaluri.totalInLucru} color="var(--blue)" />
        <KpiCard label="Aprobate" value={totaluri.totalAprobate} sub={`${totaluri.rataAprobare}% din total`} color="var(--success)" />
        <KpiCard label="Respinse" value={totaluri.totalRespinse} sub={`${totaluri.rataResp}% din total`} color="var(--danger)" />
        <KpiCard label="Programări comisie" value={totaluri.totalProgramari} color="#7c3aed" />
        <KpiCard label="Utilizatori activi" value={totaluri.totalUtilizatori} sub={`${totaluri.totalCetateni} cetățeni`} color="var(--text-1)" />
      </div>

      {/* ── Trend lunar ── */}
      <TrendChart data={dosareTrend} />

      {/* ── Distribuții ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <BarListCard title="📊 Dosare pe status" data={statusData} labels={STATUS_LABEL} colors={STATUS_COLOR} total={totaluri.totalDosare} />
        <BarListCard title="🗂️ Dosare pe categorie" data={tipData} labels={TIP_LABEL} colors={TIP_COLOR} total={totaluri.totalDosare} />
        <BarListCard title="⚡ Dosare pe prioritate" data={prioritateData} labels={{ normal: 'Normal', urgent: 'Urgent' }} colors={{ normal: '#94a3b8', urgent: '#dc2626' }} total={totaluri.totalDosare} />
        <BarListCard title="📅 Programări pe status" data={programariData} labels={PROGRAMARE_LABEL} colors={PROGRAMARE_COLOR} total={totaluri.totalProgramari} />
      </div>

      {/* ── Încărcare per funcționar ── */}
      {/* ── Încărcare per funcționar, grupată pe departamente ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>👥 Încărcare pe funcționari, pe departamente</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['total', 'Total'], ['inLucru', 'În lucru'], ['aprobate', 'Aprobate'], ['respinse', 'Respinse']].map(([key, label]) => (
              <button key={key} onClick={() => setSortKey(key)}
                className={`btn btn-sm ${sortKey === key ? 'btn-primary' : 'btn-secondary'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {functionariSortati.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Niciun funcționar activ găsit.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {DEPT_ORDINE.filter(dept => functionariPeDept[dept]?.length).map((dept) => (
              <div key={dept}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: DEPT_COLOR[dept] }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{dept}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>({functionariPeDept[dept].length} funcționari)</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 16 }}>
                  {functionariPeDept[dept].map((f) => (
                    <div key={f.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{f.nume}</span>
                        <span style={{ color: 'var(--text-3)', display: 'flex', gap: 10 }}>
                          <span>Total: <strong style={{ color: 'var(--text-1)' }}>{f.total}</strong></span>
                          <span style={{ color: 'var(--blue)' }}>În lucru: {f.inLucru}</span>
                          <span style={{ color: 'var(--success)' }}>Aprobate: {f.aprobate}</span>
                          <span style={{ color: 'var(--danger)' }}>Respinse: {f.respinse}</span>
                        </span>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: 6, height: 10, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${(f.inLucru / maxFunctionar) * 100}%`, background: 'var(--blue)' }} />
                        <div style={{ width: `${(f.aprobate / maxFunctionar) * 100}%`, background: 'var(--success)' }} />
                        <div style={{ width: `${(f.respinse / maxFunctionar) * 100}%`, background: 'var(--danger)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dosare per cetățean ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>🧑‍🤝‍🧑 Dosare per cetățean</div>
        {dosarePeCetatean.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Niciun cetățean cu dosare depuse.</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dosarePeCetatean.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nume}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {Object.entries(c.perTip).map(([tip, total]) => (
                      <span key={tip} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: TIP_COLOR[tip] || '#64748b', color: '#fff', fontWeight: 600 }}>
                        {TIP_LABEL[tip] || tip}: {total}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>{c.total}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}