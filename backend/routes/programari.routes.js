const router = require('express').Router();
const { ProgramareComisie, Dosar, Utilizator, Notificare } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const nodemailer = require('nodemailer');

// ── Mailer ───────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function trimiteEmailProgramare(email, prenume, data_ora, tip_comisie, locatie) {
  const data = new Date(data_ora).toLocaleString('ro-RO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  try {
    await transporter.sendMail({
      from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Programare comisie confirmată – ${data}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="background: #16244a; padding: 20px 24px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">DGASPC Digital</h2>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; padding: 28px 24px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 15px; color: #0f172a;">Bună ziua, <strong>${prenume}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Ați fost programat(ă) la comisia de <strong>${tip_comisie}</strong>.
            </p>
            <div style="background: #f4f6fb; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">📅 <strong>Data și ora:</strong> ${data}</p>
              <p style="margin: 0; font-size: 13px; color: #475569;">📍 <strong>Locație:</strong> ${locatie || 'Sediul DGASPC'}</p>
            </div>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
              Vă rugăm să vă prezentați cu 10 minute înainte de ora programată, cu actele de identitate valabile.
            </p>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email error:', e.message);
  }
}


// ── GET /api/programari ───────────────────────────────────
router.get('/', verificaToken, async (req, res) => {
  try {
    let unde = {};
    
    if (req.utilizator.rol === 'funcționar') {
      unde = { funcționar_id: req.utilizator.id };
    }

    const programari = await ProgramareComisie.findAll({
      where: unde,
      include: [{ model: Dosar }]
    });
    
    res.json(programari);
  } catch (err) {
    console.error('Eroare la preluare programari:', err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;

// POST /api/programari
router.get('/', verificaToken, async (req, res) => {
  try {
    const rol  = req.utilizator.Rol?.nume || req.utilizator.rol;
    const id   = req.utilizator.id;

    if (rol === 'cetățean') {
      // Cetățeanul vede programările dosarelor sale
      const programari = await ProgramareComisie.findAll({
        include: [{
          model: Dosar,
          where: { cetatean_id: id },
          required: true,
        }],
        order: [['data_ora_programare', 'ASC']],
      });
      return res.json(programari);
    }

    // Funcționar/manager/admin
    let unde = {};
    if (['funcționar'].includes(rol)) {
      // programările legate de dosarele alocate funcționarului
      unde = {};
    }

    const programari = await ProgramareComisie.findAll({
      where: unde,
      include: [{ model: Dosar }],
      order: [['data_ora_programare', 'ASC']],
    });
    res.json(programari);
  } catch (err) {
    console.error('Eroare la preluare programari:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// PATCH /api/programari/:id/status
router.patch('/:id/status', verificaToken,
  verificaRol('funcționar', 'manager', 'administrator'),
  async (req, res) => {
    try {
      const p = await ProgramareComisie.findByPk(req.params.id);
      if (!p) return res.status(404).json({ eroare: 'Programare negăsită' });
      await p.update({ status: req.body.status });
      res.json(p);
    } catch (err) {
      res.status(500).json({ eroare: err.message });
    }
  }
);

module.exports = router;