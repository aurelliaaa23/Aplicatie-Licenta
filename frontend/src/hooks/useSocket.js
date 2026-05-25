import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const SOCKET_URL = 'http://localhost:5000';

export function useSocket(utilizatorId, onNotificare) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!utilizatorId) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket conectat:', socket.id);
      socket.emit('join_room', utilizatorId);
    });

    // Eveniment: dosar actualizat
    socket.on('dosar_actualizat', (data) => {
      const { status, numar_dosar } = data;
      const mesaje = {
        aprobat:   `✅ Dosarul ${numar_dosar} a fost aprobat!`,
        respins:   `❌ Dosarul ${numar_dosar} a fost respins.`,
        incomplet: `⚠️ Dosarul ${numar_dosar} necesită completări.`,
        in_analiza:`📋 Dosarul ${numar_dosar} este în analiză.`,
      };
      const msg = mesaje[status] || `Dosar ${numar_dosar} actualizat.`;
      toast.info(msg, { autoClose: 6000 });
      if (onNotificare) onNotificare(data);
    });

    // Eveniment: programare nouă
    socket.on('programare_noua', (data) => {
      toast.success(`📅 Ai o programare pe ${new Date(data.data_ora).toLocaleDateString('ro-RO')}`, { autoClose: 8000 });
      if (onNotificare) onNotificare(data);
    });

    // Eveniment: document nou pe dosar
    socket.on('document_adaugat', (data) => {
      toast.info(`📎 Document nou adăugat la dosarul ${data.numar_dosar}`);
      if (onNotificare) onNotificare(data);
    });

    socket.on('disconnect', () => console.log('Socket deconectat'));
    socket.on('connect_error', (err) => console.error('Eroare socket:', err));

    return () => {
      socket.disconnect();
    };
  }, [utilizatorId]);

  return socketRef.current;
}