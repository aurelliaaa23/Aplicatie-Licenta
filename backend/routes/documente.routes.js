const router = require('express').Router();
const path = require('path');
const { Document, Dosar, IstoricActiuni, SolicitareMedicala } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const PDFDocument = require('pdfkit');
const fs = require('fs');

function eliminaDiacritice(str) {
  if (!str) return '';
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/Ș/g, 'S').replace(/Ț/g, 'T')
    .replace(/Ă/g, 'A').replace(/Â/g, 'A').replace(/Î/g, 'I');
}

function calculeazaVarsta(cnp) {
  if (!cnp || cnp.length !== 13) return '';
  const s = parseInt(cnp.charAt(0));
  let an = parseInt(cnp.substring(1, 3));
  if (s === 1 || s === 2) an += 1900;
  else if (s === 5 || s === 6) an += 2000;
  else an += 1900;
  return new Date().getFullYear() - an;
}

// ── POST /api/documente/upload (REPARAT CALEA FIȘIERELOR) ───────────────────
router.post('/upload', verificaToken, upload.single('fisier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ eroare: 'Niciun fișier primit' });
    const { dosar_id, tip_document } = req.body;

    const doc = await Document.create({
      dosar_id, 
      utilizator_id: req.utilizator.id,
      tip_document,
      nume_fisier: req.file.originalname,
      // Am repus ID-ul utilizatorului pt a găsi exact folderul creat de Multer
      cale_fisier: `uploads/${req.utilizator.id}/${req.file.filename}`, 
      marime_bytes: req.file.size,
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, 
      dosar_id:      dosar_id,
      actiune:       'Document încărcat',
      detalii:       `Tip document: ${tip_document}, Fișier: ${req.file.originalname}`,
      adresa_ip:     req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    res.status(201).json(doc);
  } catch (err) {
    console.error('Eroare upload:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/documente/semnatura (REPARAT GENERARE FIZICĂ + ISTORIC) ───────
router.post('/semnatura', verificaToken, async (req, res) => {
  try {
    const { dosar_id, semnatura_base64 } = req.body;
    if (!semnatura_base64) return res.status(400).json({ eroare: 'Semnătură lipsă' });

    // 1. Salvăm FIZIC fișierul PNG pe server
    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `semnatura_${dosar_id}_${Date.now()}.png`;
    const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(dir, fileName), base64Data, 'base64');

    // 2. Salvăm referința în Baza de Date
    const doc = await Document.create({
      dosar_id,
      nume_fisier:     'Semnatura_electronica.png',
      cale_fisier:     `uploads/${req.utilizator.id}/${fileName}`,
      tip_document:    'semnatura',
      status_document: 'incarcat',
      semnat_digital:  true,
      date_semnatura:  JSON.stringify({ timestamp: new Date(), utilizator_id: req.utilizator.id }),
    });

    // 3. Înregistrăm în istoric
    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar_id, // Lipsa acestei linii cauza eroarea mută!
      actiune:       'Semnătură electronică aplicată',
      detalii:       'Cetățeanul a aplicat semnătura olografă pentru cerere.',
      adresa_ip:     req.ip,
    }).catch(err => console.error("Eroare istoric semnătură:", err));

    res.status(201).json({ mesaj: 'Semnătură salvată cu succes', id: doc.id });
  } catch (err) {
    console.error('Eroare semnatura:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/documente/genereaza-cerere-handicap ────────────────────────────
router.post('/genereaza-cerere-handicap', verificaToken, async (req, res) => {
  try {
    const { dosar_id, date_cerere, semnatura_base64 } = req.body;
    const user = req.utilizator;

    const uploadPath = path.join(__dirname, '../uploads', String(user.id));
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

    const numeFisier  = `Cerere_Handicap_${dosar_id}_${Date.now()}.pdf`;
    const caleAbsoluta = path.join(uploadPath, numeFisier);

    const doc    = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(caleAbsoluta);
    doc.pipe(stream);

    const numeComplet    = eliminaDiacritice(`${user.nume} ${user.prenume}`);
    const serieCi        = eliminaDiacritice(date_cerere.serie_ci);
    const numarCi        = date_cerere.numar_ci;
    const cnp            = user.cnp;
    const judet          = eliminaDiacritice(user.judet || '');
    const oras           = eliminaDiacritice(user.oras  || '');
    const stradaDetaliata = eliminaDiacritice(date_cerere.strada || '');
    const telefon        = user.telefon;
    const email          = eliminaDiacritice(user.email);

    let tipT = 'Dosar Nou';
    if (date_cerere.tip_cerere === 'reevaluare_expirat')  tipT = 'Reevaluare pentru dosar expirat';
    if (date_cerere.tip_cerere === 'reevaluare_agravare') tipT = 'Reevaluare pentru agravare stare de sanatate';
    tipT = eliminaDiacritice(tipT);

    doc.fontSize(12).font('Helvetica-Bold')
       .text('SERVICIUL DE EVALUARE COMPLEXA A PERSOANELOR ADULTE CU HANDICAP', { align: 'center' });
    doc.moveDown(3);

    doc.fontSize(12).font('Helvetica-Bold').text('DOMNULE/DOAMNA DIRECTOR,');
    doc.moveDown(1.5);

    doc.fontSize(11).font('Helvetica')
       .text(`Subsemnatul(a) ${numeComplet} si legitimat(a) cu CI/BI seria ${serieCi} nr. ${numarCi} avand CNP ${cnp} cu domiciliul in orasul/localitatea ${oras}, judet/sector ${judet}, str. ${stradaDetaliata}, telefon ${telefon}, e-mail ${email} solicit evaluarea in cadrul Serviciului de Evaluare Complexa a Persoanelor Adulte cu Handicap, in vederea:`,
         { align: 'justify', lineGap: 4 });

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text(tipT, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11).font('Helvetica')
       .text('Declar pe proprie raspundere ca datele declarate in prezenta cerere sunt corecte si complete si ca documentele depuse sunt conforme cu originalul.', { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);
    doc.text('Sunt de acord ca datele mele cu caracter personal sa fie prelucrate de DGASPC in conformitate cu reglementarile GDPR.', { align: 'justify', lineGap: 3 });
    doc.moveDown(3);

    const yBazaSemnatura = doc.y;
    doc.text(`Data: ${new Date().toLocaleDateString('ro-RO')}`, 50, yBazaSemnatura);
    doc.text('Semnatura:', 350, yBazaSemnatura);

    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, "");
      const imgBuffer  = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, 340, yBazaSemnatura + 10, { width: 120 });
    }

    doc.moveDown(6);
    doc.fontSize(8).font('Helvetica')
       .text('Datele dumneavoastra cu caracter personal sunt prelucrate de D.G.A.S.P.C. in conformitate cu art. 6 din Regulamentul UE 679/2016 in scopul indeplinirii atributiilor legale.',
         50, doc.page.height - 100, { align: 'justify', lineGap: 1.5 });

    doc.end();

    stream.on('error', (err) => {
      console.error('Stream error cerere handicap:', err);
      if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la scrierea fișierului PDF.' });
    });

    stream.on('finish', async () => {
      try {
        await Document.create({
          dosar_id,
          utilizator_id:   user.id,
          nume_fisier:     'Cerere_Evaluare_Handicap.pdf',
          cale_fisier:     `uploads/${user.id}/${numeFisier}`,
          tip_document:    'alte',
          status_document: 'incarcat',
        });
        res.json({ mesaj: 'Cerere generată cu succes!' });
      } catch (dbErr) {
        console.error('Eroare DB după generare cerere handicap:', dbErr);
        if (!res.headersSent) res.status(500).json({ eroare: dbErr.message });
      }
    });

  } catch (err) {
    console.error('Eroare la generare PDF:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/documente/genereaza-scrisoare-medicala ─────────────────────────
router.post('/genereaza-scrisoare-medicala', verificaToken, async (req, res) => {
  // (Logica veche a rămas neatinsă, folosim ruta nouă din dosare.routes.js pentru medicii care completează PDF-ul pe dosar)
  res.status(200).send("Folosiți ruta din dosare.routes.js");
});

// ── POST /api/documente/genereaza-referat-specialist ─────────────────────────
router.post('/genereaza-referat-specialist', verificaToken, async (req, res) => {
   // (Logica veche a rămas neatinsă)
   res.status(200).send("Folosiți ruta din dosare.routes.js");
});

module.exports = router;