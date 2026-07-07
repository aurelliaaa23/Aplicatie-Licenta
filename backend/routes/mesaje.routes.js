const router = require('express').Router();
const { IstoricActiuni, Dosar, Utilizator } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');

const ACTIUNE_MESAJ = 'Mesaj chat';

function poateAccesaDosarul(dosar, utilizator) {
  const rol = utilizator.Rol?.nume;
  if (rol === 'administrator' || rol === 'manager') return true;
  if (dosar.cetatean_id === utilizator.id) return true;
  if (dosar.functionar_id === utilizator.id) return true;
  return false;
}

// ── GET /api/mesaje/:dosarId — istoricul conversației unui dosar ───────────
// ── GET /api/mesaje/:dosarId — istoricul conversației unui dosar ───────────
// Tabela istoric_actiuni nu are (real, în DB) coloana dosar_id folosibilă în WHERE,
// deci codificăm dosarul chiar în text: "[DOSAR:7] mesajul propriu-zis".
router.get('/:dosarId', verificaToken, async (req, res) => {
  try {
    const dosar = await Dosar.findByPk(req.params.dosarId);
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });
    if (!poateAccesaDosarul(dosar, req.utilizator)) return res.status(403).json({ eroare: 'Acces interzis' });

    const toateMesajele = await IstoricActiuni.findAll({
      where: { actiune: ACTIUNE_MESAJ },
      order: [['creat_la', 'ASC']],
    });

    const prefix = `[DOSAR:${req.params.dosarId}]`;
    const mesajeDosar = toateMesajele.filter(m => m.detalii && m.detalii.startsWith(prefix));

    const idsUnice = [...new Set(mesajeDosar.map(m => m.utilizator_id))];
    const utilizatori = await Utilizator.findAll({ where: { id: idsUnice }, attributes: ['id', 'nume', 'prenume'] });
    const numeMap = Object.fromEntries(utilizatori.map(u => [u.id, `${u.prenume} ${u.nume}`]));

    res.json(mesajeDosar.map(m => ({
      id: m.id,
      text: m.detalii.slice(prefix.length).trim(),
      utilizator_id: m.utilizator_id,
      esteCetatean: m.utilizator_id === dosar.cetatean_id,
      nume: numeMap[m.utilizator_id] || 'Utilizator',
      creat_la: m.creat_la,
    })));
  } catch (err) {
    console.error('Eroare listare mesaje:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/mesaje — trimite un mesaj nou pe un dosar ────────────────────
router.post('/', verificaToken, async (req, res) => {
  try {
    const { dosar_id, text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ eroare: 'Mesajul nu poate fi gol' });

    const dosar = await Dosar.findByPk(dosar_id);
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });
    if (!poateAccesaDosarul(dosar, req.utilizator)) return res.status(403).json({ eroare: 'Acces interzis' });

    const mesaj = await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      actiune: ACTIUNE_MESAJ,
      detalii: `[DOSAR:${dosar_id}] ${text.trim().slice(0, 2000)}`,
      adresa_ip: req.ip,
    });

    // Notificăm în timp real cealaltă parte a conversației (cetățean <-> funcționar alocat)
    const destinatarId = req.utilizator.id === dosar.cetatean_id ? dosar.functionar_id : dosar.cetatean_id;
    const io = req.app.get('io');
    if (io && destinatarId) {
      io.to(`user_${destinatarId}`).emit('mesaj_nou', {
        dosar_id,
        numar_dosar: dosar.numar_dosar,
        text: mesaj.detalii,
        de_la: `${req.utilizator.prenume} ${req.utilizator.nume}`,
      });
    }

    res.status(201).json({
      id: mesaj.id,
      text: text.trim().slice(0, 2000),
      utilizator_id: req.utilizator.id,
      esteCetatean: req.utilizator.id === dosar.cetatean_id,
      nume: `${req.utilizator.prenume} ${req.utilizator.nume}`,
      creat_la: mesaj.creat_la,
    });
  } catch (err) {
    console.error('Eroare trimitere mesaj:', err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;