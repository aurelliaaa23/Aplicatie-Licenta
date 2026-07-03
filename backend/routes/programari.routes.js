const express = require('express');
const router = express.Router();
const { ProgramareComisie, Dosar, Utilizator, IstoricActiuni } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');
const nodemailer = require('nodemailer');

// Configurare Nodemailer pentru E-mailuri
const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── GET /api/programari ───────────────────────────────────────────────────────
router.get('/', verificaToken, async (req, res) => {
  try {
    const { rol, id } = req.utilizator;
    let whereClause = {};
    
    if (rol === 'cetățean') {
      const dosareleMele = await Dosar.findAll({ where: { cetatean_id: id }, attributes: ['id'] });
      const dosarIds = dosareleMele.map(d => d.id);
      whereClause = { dosar_id: dosarIds };
    }

    const programari = await ProgramareComisie.findAll({
      where: whereClause,
      include: [{ model: Dosar }] 
    });
    res.json(programari);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/programari (CREARE PROGRAMARE + EMAIL CETĂȚEAN) ────────────────
router.post('/', verificaToken, async (req, res) => {
  try {
    const { dosar_id, tip_comisie, data_ora, durata_minute, locatie } = req.body;
    
    const dosar = await Dosar.findByPk(dosar_id, {
      include: [{ model: Utilizator, as: 'cetatean' }]
    });

    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit!' });

    // 1. Creăm programarea folosind EXACT numele coloanelor din baza de date
    const programare = await ProgramareComisie.create({
      dosar_id,
      functionar_id: req.utilizator.id, 
      tip_comisie,
      data_ora_programare: data_ora, // FIX: Am corectat denumirea coloanei
      detalii: "Programarea va dura " + durata_minute || 30 + "  și va fi la " + locatie || 'Sediul DGASPC',
    });

    // 2. Actualizăm statusul dosarului
    await dosar.update({ status: 'programat_comisie' });

    // 3. Salvăm în istoric
    const dataFormatata = new Date(data_ora).toLocaleString('ro-RO');
    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id: dosar_id,
      actiune: 'Dosar programat la comisie',
      detalii: `Data: ${dataFormatata}, Locație: ${locatie || 'Sediul DGASPC'}`,
      ip_adresa: req.ip
    }).catch(e => console.error("Eroare istoric:", e));

    // 4. Trimitem E-mailul cetățeanului
    if (dosar.cetatean && dosar.cetatean.email) {
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: dosar.cetatean.email,
        subject: `[DGASPC] Programare Comisie - Dosar ${dosar.numar_dosar}`,
        html: `<p>Bună ziua, <strong>${dosar.cetatean.prenume} ${dosar.cetatean.nume}</strong>,</p>
               <p>Vă informăm că dosarul dumneavoastră cu numărul <strong>${dosar.numar_dosar}</strong> a fost validat.</p>
               <p>Ați fost programat/ă la comisie pentru evaluare.</p>
               <div style="background:#f0f9ff; padding:15px; border-radius:8px; margin: 20px 0; border: 1px solid #bae6fd;">
                 <p style="margin: 0 0 10px 0;">📅 <strong>Data și ora:</strong> ${dataFormatata}</p>
                 <p style="margin: 0;">📍 <strong>Locația:</strong> ${locatie || 'Sediul DGASPC'}</p>
               </div>
               <p>Vă rugăm să vă prezentați cu 10 minute înainte de ora stabilită, având la dumneavoastră actul de identitate în original.</p>
               <p>O zi excelentă,<br>Echipa DGASPC</p>`
      }).catch(err => console.error("Eroare trimitere email:", err));
    }

    res.status(201).json(programare);
  } catch (err) {
    console.error("Eroare creare programare:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── PATCH /api/programari/:id/status ─────────────────────────────────────────
router.patch('/:id/status', verificaToken, async (req, res) => {
  try {
    const { status } = req.body;
    const programare = await ProgramareComisie.findByPk(req.params.id);
    if (!programare) return res.status(404).json({ eroare: 'Programare negasita' });
    await programare.update({ status });
    res.json({ mesaj: 'Status actualizat' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;