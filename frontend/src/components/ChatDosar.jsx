import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = 'http://localhost:5000';

export default function ChatDosar({ dosarId }) {
  const { utilizator } = useAuth();
  const [mesaje, setMesaje] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [trimitand, setTrimitand] = useState(false);
  const scrollRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchMesaje();

    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current.emit('join_room', utilizator.id);
    socketRef.current.on('mesaj_nou', (data) => {
      if (String(data.dosar_id) === String(dosarId)) {
        fetchMesaje();
      }
    });

    return () => socketRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dosarId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mesaje]);

  const fetchMesaje = async () => {
    try {
      const { data } = await api.get(`/mesaje/${dosarId}`);
      setMesaje(data);
    } catch (err) {
      // silent — nu întrerupem pagina dosarului pentru o eroare de chat
    } finally {
      setLoading(false);
    }
  };

  const trimite = async () => {
    const text = input.trim();
    if (!text || trimitand) return;
    setTrimitand(true);
    try {
      await api.post('/mesaje', { dosar_id: dosarId, text });
      setInput('');
      fetchMesaje();
    } catch (err) {
      // silent
    } finally {
      setTrimitand(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trimite(); }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 420, marginTop: 20 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
        💬 Mesaje despre acest dosar
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 20 }}>Se încarcă...</div>
        ) : mesaje.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 20 }}>Nicio conversație încă — scrieți primul mesaj.</div>
        ) : mesaje.map((m) => {
          const esteAlMeu = m.utilizator_id === utilizator.id;
          return (
            <div key={m.id} style={{ alignSelf: esteAlMeu ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {!esteAlMeu && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, marginLeft: 4 }}>{m.nume}</div>}
              <div style={{
                background: esteAlMeu ? 'var(--blue)' : '#fff',
                color: esteAlMeu ? '#fff' : 'var(--text-1)',
                border: esteAlMeu ? 'none' : '1px solid var(--border)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.4,
              }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, textAlign: esteAlMeu ? 'right' : 'left' }}>
                {new Date(m.creat_la).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Scrieți un mesaj..."
          style={{ flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}
        />
        <button onClick={trimite} disabled={trimitand || !input.trim()} className="btn btn-primary" style={{ padding: '0 16px' }}>
          Trimite
        </button>
      </div>
    </div>
  );
}