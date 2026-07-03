import { useState, useRef, useEffect } from 'react';
import api from '../services/api';

export default function ChatbotFlotant() {
  const [deschis, setDeschis] = useState(false);
  const [mesaje, setMesaje] = useState([
    { rol: 'bot', text: 'Bună! Sunt asistentul virtual DGASPC. Cu ce vă pot ajuta — tipuri de dosare, acte necesare, sau alte neclarități?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mesaje, deschis]);

  const trimiteMesaj = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const istoricPentruApi = mesaje.map(m => ({ rol: m.rol, text: m.text }));
    setMesaje(prev => [...prev, { rol: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/chatbot/mesaj', { mesaj: text, istoric: istoricPentruApi });
      setMesaje(prev => [...prev, { rol: 'bot', text: data.raspuns }]);
    } catch (err) {
      setMesaje(prev => [...prev, { rol: 'bot', text: 'Ne pare rău, asistentul nu este disponibil momentan. Încercați din nou puțin mai târziu.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trimiteMesaj(); }
  };

  return (
    <>
      <button
        onClick={() => setDeschis(d => !d)}
        style={{
          position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
          background: 'var(--blue, #2563eb)', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(37,99,235,0.4)', zIndex: 1000, fontSize: 24,
        }}
        aria-label="Deschide asistentul virtual"
      >
        {deschis ? '✕' : '💬'}
      </button>

      {deschis && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, width: 340, maxWidth: '90vw', height: 460,
          background: '#fff', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000,
          border: '1px solid var(--border, #e2e8f0)',
        }}>
          <div style={{ background: 'var(--navy, #16244a)', color: '#fff', padding: '12px 16px', fontWeight: 700, fontSize: 14 }}>
            🤖 Asistent virtual DGASPC
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc' }}>
            {mesaje.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start',
                background: m.rol === 'user' ? 'var(--blue, #2563eb)' : '#fff',
                color: m.rol === 'user' ? '#fff' : '#1a1a1a',
                border: m.rol === 'user' ? 'none' : '1px solid var(--border, #e2e8f0)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13, maxWidth: '85%', lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: 12.5, padding: '4px 12px' }}>
                Asistentul scrie...
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--border, #e2e8f0)' }}>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Scrieți o întrebare..."
              style={{ flex: 1, resize: 'none', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button
              onClick={trimiteMesaj}
              disabled={loading || !input.trim()}
              style={{ background: 'var(--blue, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 600, opacity: (loading || !input.trim()) ? 0.6 : 1 }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}