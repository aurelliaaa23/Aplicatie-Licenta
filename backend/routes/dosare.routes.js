const router = require('express').Router();
const { Dosar, Utilizator, Document, Notificare, IstoricActiuni, SolicitareMedicala } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const nodemailer = require('nodemailer');

// Mapare tip → departament
function mapTipLaDepartament(tip) {
  const map = {
    certificat_handicap: 'Evaluare Complexă',
    adoptie:             'Adopții',
    plasament:           'Protecția Copilului',
    alocatie:            'Prestații Sociale',
    evaluare_adulti:     'Adulți cu Handicap',
    alte_servicii:       'General',
  };
  return map[tip] || 'General';
}

// ── GET /api/dosare ───────────────────────────────────────
router.get('/', verificaToken, async (req, res) => {
  try {
    const rolNume = req.utilizator.Rol?.nume;
    const userId  = req.utilizator.id;
    let where = {};

    if (rolNume === 'cetățean') {
      where = { cetatean_id: userId };
    } else if (['funcționar', 'medic', 'funcționar_primărie', 'reprezentant_școală'].includes(rolNume)) {
      where = { functionar_id: userId };
    }
    // manager și administrator văd toate

    const dosare = await Dosar.findAll({
      where,
      include: [
        { model: Utilizator, as: 'cetatean',   attributes: ['id', 'nume', 'prenume', 'email', 'telefon'] },
        { model: Utilizator, as: 'functionar', attributes: ['id', 'nume', 'prenume', 'departament'] },
        { model: Document },
      ],
      order: [['creat_la', 'DESC']],
    });
    res.json(dosare);
  } catch (err) {
    console.error('GET /dosare error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── GET /api/dosare/:id ───────────────────────────────────
router.get('/:id', verificaToken, async (req, res) => {
  try {
    const dosar = await Dosar.findByPk(req.params.id, {
      include: [
        { model: Utilizator, as: 'cetatean',   attributes: ['id', 'nume', 'prenume', 'email', 'telefon', 'cnp'] },
        { model: Utilizator, as: 'functionar', attributes: ['id', 'nume', 'prenume', 'departament'] },
        { model: Document,
          required: false
         },
      ],
      order: [[Document, 'id', 'DESC']]
    });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });
    res.json(dosar);
  } catch (err) {
    console.error('GET /dosare/:id error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/dosare ──────────────────────────────────────
router.post('/', verificaToken, verificaRol('cetățean'), async (req, res) => {
  try {
    const { tip, descriere, prioritate } = req.body;
    const numar = `DGASPC-${Date.now()}`;

    const dosar = await Dosar.create({
      numar_dosar:  numar,
      tip,
      descriere,
      prioritate:   prioritate || 'normal',
      cetatean_id:  req.utilizator.id,
      departament:  mapTipLaDepartament(tip),
      status:       'depus',
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar.id,
      actiune:       'Dosar creat',
      detalii:       { tip, numar_dosar: numar },
      ip_adresa:     req.ip,
    }).catch(() => {}); // nu bloca dacă audit fail

    res.status(201).json(dosar);
  } catch (err) {
    console.error('POST /dosare error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── PATCH /api/dosare/:id/status ─────────────────────────
router.patch('/:id/status', verificaToken,
  verificaRol('funcționar', 'manager', 'administrator'),
  async (req, res) => {
    try {
      const dosar = await Dosar.findByPk(req.params.id, {
        include: [{ model: Utilizator, as: 'cetatean' }],
      });
      if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

      const { status, motiv_respingere } = req.body;
      await dosar.update({ status, motiv_respingere: motiv_respingere || null });

      // Notificare cetățean
      await Notificare.create({
        utilizator_id: dosar.cetatean_id,
        dosar_id:      dosar.id,
        titlu:         `Dosar ${dosar.numar_dosar} actualizat`,
        mesaj:         `Statusul dosarului tău a fost schimbat în: ${status}`,
        tip:           status === 'aprobat' ? 'succes' : status === 'respins' ? 'eroare' : 'info',
      }).catch(() => {});

      // Socket real-time
      const io = req.app.get('io');
      io.to(`user_${dosar.cetatean_id}`).emit('dosar_actualizat', {
        dosar_id:     dosar.id,
        status,
        numar_dosar:  dosar.numar_dosar,
      });

      await IstoricActiuni.create({
        utilizator_id: req.utilizator.id,
        dosar_id:      dosar.id,
        actiune:       `Status schimbat în: ${status}`,
        detalii:       { status_nou: status },
        ip_adresa:     req.ip,
      }).catch(() => {});

      res.json(dosar);
    } catch (err) {
      console.error('PATCH /dosare/:id/status error:', err);
      res.status(500).json({ eroare: err.message });
    }
  }
);

// ── POST /api/dosare/:id/notifica-medici ───────────────────────────────────
router.post('/:id/notifica-medici', verificaToken, async (req, res) => {
  try {
    const { medici } = req.body;
    const dosarId = req.params.id;
    const cetatean = req.utilizator; // Datele utilizatorului logat care depune dosarul

    // IMPORTANT: Aici pui setările tale reale cu care trimiți e-mailuri în aplicație
    // (Aceleași de la ruta de Register / OTP)
    const mailer = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // Luăm fiecare medic selectat și îi "trimitem" un e-mail
    for (const medic of medici) {
      const medicCurent = await Utilizator.findByPk(medic.id);
      
      // Protecție în caz că medicul nu e găsit
      if (!medicCurent) continue; 
      
      await SolicitareMedicala.create({
        medic_id: medicCurent.id,
        cetatean_id: cetatean.id,
        dosar_id: dosarId,
        status: 'in_asteptare'
      });

      const mailOptions = {
        // ✅ CORECȚIA 2: Am pus backticks (`) ca să citească adresa de e-mail din .env
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: medicCurent.email, 
        subject: `[DGASPC] ACȚIUNE NECESARĂ: Referat medical dosar #${dosarId}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #1e2f5c; margin: 0;">DGASPC Digital</h2>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Sistemul Electronic de Management al Dosarelor</p>
            </div>
            
            <p>Stimate/ă <strong>Dr. ${medicCurent.prenume} ${medicCurent.nume}</strong> (${medic.tip}),</p>
            
            <p>Vă informăm că pacientul <strong>${cetatean.nume} ${cetatean.prenume}</strong> a depus un dosar de evaluare (Cod Dosar: <strong>#${dosarId}</strong>) pe platforma DGASPC și v-a selectat ca medic curant pentru a furniza documentele medicale suport.</p>
            
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af;"><strong>Ce trebuie să faceți:</strong></p>
              <ul style="margin-top: 8px; margin-bottom: 0; color: #1e3a8a;">
                <li>Autentificați-vă în contul dumneavoastră de medic.</li>
                <li>Găsiți pacientul în lista de solicitări în așteptare.</li>
                <li>Încărcați și semnați Scrisoarea Medicală / Referatul de specialitate.</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:3000/login" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Autentificare în Platformă</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px; margin-bottom: 20px;" />
            <p style="font-size: 11px; color: #999; text-align: center; margin: 0;">
              Acesta este un mesaj generat automat. Vă rugăm să nu răspundeți la acest e-mail. Datele sunt prelucrate conform politicilor GDPR ale instituției.
            </p>
          </div>
        `
      };

      // Trimitem e-mailul
      await mailer.sendMail(mailOptions);
    }
    res.json({ mesaj: 'Medicii au fost notificați cu succes!' });
  } catch (err) {
    console.error('Eroare notificare medici:', err);
    res.status(500).json({ eroare: 'Nu s-au putut trimite notificările.' });
  }
});

router.get('/medici/solicitari', verificaToken, async (req, res) => {
  try {
    const solicitari = await SolicitareMedicala.findAll({
      where: { medic_id: req.utilizator.id },
      include: [
        { model: Utilizator, as: 'cetatean', attributes: ['nume', 'prenume', 'cnp', 'telefon', 'email'] },
        { model: Dosar, as: 'dosar', attributes: ['numar_dosar', 'creat_la'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(solicitari);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});    

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// ── POST /api/dosare/:id/scrisoare-medicala ──────────────────────────────
router.post('/:id/scrisoare-medicala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { 
      nume, prenume, cnp, varsta, 
      anamneza, diagnostic_principal, diagnostic_secundar, 
      internari, deplasabil, semnatura_base64 
    } = req.body;

    const doc = new PDFDocument({ margin: 50 });
    
    // Asigură-te că folderul de upload există
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const fileName = `Scrisoare_Medicala_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);

    // Titlu
    doc.fontSize(16).font('Helvetica-Bold').text('SCRISOARE MEDICALĂ', { align: 'center' });
    doc.moveDown(1.5);

    // Date pacient
    doc.fontSize(12).font('Helvetica');
    doc.text(`Numele: ${nume}, Prenumele: ${prenume}, CNP: ${cnp}, vârsta: ${varsta} ani.`);
    doc.moveDown();

    // 1. Anamneza
    doc.font('Helvetica-Bold').text('1. Anamneza');
    doc.font('Helvetica').text('- antecedente personale patologice:');
    doc.text(anamneza || '............................................................................');
    doc.moveDown();

    // 2. Diagnostic medical
    doc.font('Helvetica-Bold').text('2. Diagnosticul medical');
    doc.font('Helvetica').text('- principal:');
    doc.text(diagnostic_principal || '............................................................................');
    doc.moveDown(0.5);
    doc.text('- secundar / altele:');
    doc.text(diagnostic_secundar || '............................................................................');
    doc.moveDown();

    // 3. Internări în spital
    doc.font('Helvetica-Bold').text('3. Internări în spital (data, instituția emitentă și diagnosticul la ieșire)');
    doc.font('Helvetica');
    if (internari && internari.length > 0) {
      internari.forEach(int => {
        doc.text(`Perioada: ${int.data_inceput} - ${int.data_sfarsit}`);
        doc.text(`Unitatea: ${int.unitate}`);
        doc.text(`Diagnostic la ieșire: ${int.diagnostic}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.text('............................................................................');
    }
    doc.moveDown();

    // 4. Deplasabilitate
    doc.font('Helvetica-Bold').text('4. Starea de deplasabilitate');
    doc.font('Helvetica');
    doc.text(`Persoana: ${deplasabil}`);
    doc.moveDown(2);

    // Semnături și Dată
    doc.text(`Data completării: ${new Date().toLocaleDateString('ro-RO')}`);
    doc.moveDown(2);
    
    doc.text('Semnătura medicului de familie:');
    if (semnatura_base64) {
      // Curăță prefixul bazei 64 creat în canvas
      const base64Data = semnatura_base64.replace(/^data:image\/(png|jpeg);base64,/, "");
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, { width: 150 });
    }

    doc.end();

    stream.on('finish', async () => {
      // Creăm înregistrarea Document în baza de date
      await Document.create({
        dosar_id: dosarId,
        utilizator_id: req.utilizator.id,
        tip_document: 'certificat_medical', // Putem folosi tipul dorit
        nume_fisier: fileName,
        cale_fisier: `uploads/${fileName}`,
        semnatura_base64: semnatura_base64
      });

      // Actualizăm starea solicitării medicale (dacă modelul este definit)
      await SolicitareMedicala.update(
        { status: 'finalizat' },
        { where: { dosar_id: dosarId, medic_id: req.utilizator.id } }
      );

      res.json({ mesaj: 'Document generat cu succes!', cale: `uploads/${fileName}` });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ eroare: 'Eroare la generarea scrisorii medicale.' });
  }
});

module.exports = router;