const router = require('express').Router();
const path = require('path');
const { Document, Dosar, IstoricActiuni, SolicitareMedicala } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const htmlToPdf = require('html-pdf-node');
const { SablonDocument } = require('../models');

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

    const sablon = await SablonDocument.findOne({ where: { nume_sablon: 'Cerere_Evaluare_Handicap' }});
    let html = sablon.continut_html;
    html = html.replace(/{{NUME}}/g, user.nume);  
    html = html.replace(/{{PRENUME}}/g, user.prenume);
    html = html.replace(/{{CNP}}/g, user.cnp);
    html = html.replace(/{{SERIE_CI}}/g, date_cerere.serie_ci);
    html = html.replace(/{{NUMAR_CI}}/g, date_cerere.numar_ci);
    html = html.replace(/{{JUDET}}/g, user.judet);
    html = html.replace(/{{ORAS}}/g, user.oras);
    html = html.replace(/{{STRADA}}/g, date_cerere.strada);
    html = html.replace(/{{TELEFON}}/g, user.telefon);
    html = html.replace(/{{EMAIL}}/g, user.email);
    html = html.replace(/{{TIP_CERERE}}/g, date_cerere.tip_cerere === 'dosar_nou' ? 'Dosar Nou' : 'Reevaluare');
    html = html.replace(/{{SEMNATURA_BASE64}}/g, semnatura_base64 || '');
    html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));

    const pdfBuffer = await htmlToPdf.generatePdf({ content: html }, { format: 'A4', margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' } });
    fs.writeFileSync(caleAbsoluta, pdfBuffer);


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