const router = require('express').Router();
const { Notificare } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');

// GET /api/notificari
router.get('/', verificaToken, async (req, res) => {
  try {
    const notificari = await Notificare.findAll({
      where: { utilizator_id: req.utilizator.id },
      order: [['creat_la', 'DESC']],
      limit: 50,
    });
    res.json(notificari);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// PATCH /api/notificari/mark-all-read
router.patch('/mark-all-read', verificaToken, async (req, res) => {
  try {
    await Notificare.update(
      { citita: true },
      { where: { utilizator_id: req.utilizator.id, citita: false } }
    );
    res.json({ mesaj: 'Toate notificările marcate ca citite' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// PATCH /api/notificari/:id/citita
router.patch('/:id/citita', verificaToken, async (req, res) => {
  try {
    const n = await Notificare.findOne({
      where: { id: req.params.id, utilizator_id: req.utilizator.id },
    });
    if (!n) return res.status(404).json({ eroare: 'Notificare negăsită' });
    await n.update({ citita: true });
    res.json(n);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;