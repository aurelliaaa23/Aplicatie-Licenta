const router = require('express').Router();
const path = require('path');
const { Document, Dosar, IstoricActiuni, SolicitareMedicala } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const htmlToPdf = require('html-pdf-node');
const { SablonDocument, Utilizator } = require('../models');

function eliminaDiacritice(str) {
  if (!str) return '';
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/Ș/g, 'S').replace(/Ț/g, 'T')
    .replace(/Ă/g, 'A').replace(/Â/g, 'A').replace(/Î/g, 'I');
}

// ── POST /api/documente/upload ──────────────────────────────────────────────
router.post('/upload', verificaToken, upload.single('fisier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ eroare: 'Niciun fișier primit' });
    const { dosar_id, tip_document } = req.body;

    const doc = await Document.create({
      dosar_id, 
      utilizator_id: req.utilizator.id,
      tip_document,
      nume_fisier: req.file.originalname,
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

// ── POST /api/documente/semnatura ───────────────────────────────────────────
router.post('/semnatura', verificaToken, async (req, res) => {
  try {
    const { dosar_id, semnatura_base64 } = req.body;
    if (!semnatura_base64) return res.status(400).json({ eroare: 'Semnătură lipsă' });

    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `semnatura_${dosar_id}_${Date.now()}.png`;
    const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(dir, fileName), base64Data, 'base64');

    const doc = await Document.create({
      dosar_id,
      nume_fisier:     'Semnatura_electronica.png',
      cale_fisier:     `uploads/${req.utilizator.id}/${fileName}`,
      tip_document:    'semnatura',
      status_document: 'incarcat',
      semnat_digital:  true,
      date_semnatura:  JSON.stringify({ timestamp: new Date(), utilizator_id: req.utilizator.id }),
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar_id,
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

    let tipT = 'Dosar Nou';
    if (date_cerere.tip_cerere === 'reevaluare_expirat')  tipT = 'Reevaluare pentru dosar expirat';
    if (date_cerere.tip_cerere === 'reevaluare_agravare') tipT = 'Reevaluare pentru agravare stare de sanatate';

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

    await Document.create({
      dosar_id,
      utilizator_id:   user.id,
      nume_fisier:     'Cerere_Evaluare_Handicap.pdf',
      cale_fisier:     `uploads/${user.id}/${numeFisier}`,
      tip_document:    'alte',
      status_document: 'incarcat',
    });
    res.json({ mesaj: 'Cerere generată cu succes!' });

  } catch (err) {
    console.error('Eroare la generare PDF:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/documente/genereaza-cerere-copil ───────────────────────────────
router.post('/genereaza-cerere-copil', verificaToken, async (req, res) => {
  try {
    const { dosar_id, tip_dosar, date_cerere, date_familie, date_indemnizatie, date_copil, semnatura_base64 } = req.body;
    
    const dosar = await Dosar.findByPk(dosar_id);
    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit' });
    const cetatean = await Utilizator.findByPk(dosar.cetatean_id);

    const numeSablon = tip_dosar === 'alocatie' ? 'Cerere_Alocatie_Stat' : 'Cerere_Indemnizatie';
    const sablon = await SablonDocument.findOne({ where: { nume_sablon: numeSablon } });
    if (!sablon) return res.status(404).json({ eroare: 'Șablonul nu există în baza de date' });

    let html = sablon.continut_html;

    html = html.replace(/{{NUME}}/g, cetatean.nume);
    html = html.replace(/{{PRENUME}}/g, cetatean.prenume);
    html = html.replace(/{{CNP}}/g, cetatean.cnp || '-');
    html = html.replace(/{{JUDET}}/g, cetatean.judet || '-');
    html = html.replace(/{{ORAS}}/g, cetatean.oras || '-');
    html = html.replace(/{{STRADA}}/g, date_cerere.strada || '-');
    html = html.replace(/{{TELEFON}}/g, cetatean.telefon || '-');
    html = html.replace(/{{EMAIL}}/g, cetatean.email || '-');
    html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));
    html = html.replace(/{{SEMNATURA_BASE64}}/g, semnatura_base64 || '');
    
    html = html.replace(/{{NUME_COPIL}}/g, date_copil.nume || '-');
    html = html.replace(/{{PRENUME_COPIL}}/g, date_copil.prenume || '-');
    html = html.replace(/{{CNP_COPIL}}/g, date_copil.cnp || '-');

    if (tip_dosar === 'alocatie') {
      html = html.replace(/{{SERIE_CI}}/g, date_cerere.serie_ci);
      html = html.replace(/{{NUMAR_CI}}/g, date_cerere.numar_ci);
      
      let numeSot = date_familie.tipFamilie === 'integrala' && date_familie.numeSot ? date_familie.numeSot : '-';
      let cnpSot = date_familie.tipFamilie === 'integrala' && date_familie.cnpSot ? date_familie.cnpSot : '-';
      html = html.replace(/{{NUME_SOT}}/g, numeSot);
      html = html.replace(/{{CNP_SOT}}/g, cnpSot);
    }

    if (tip_dosar === 'indemnizatie') {
      let numeSot = date_familie.tipFamilie === 'integrala' && date_familie.numeSot ? date_familie.numeSot : '-';
      let cnpSot = date_familie.tipFamilie === 'integrala' && date_familie.cnpSot ? date_familie.cnpSot : '-';
      let beneficiar = date_indemnizatie.beneficiar === 'titular' ? `${cetatean.nume} ${cetatean.prenume}` : numeSot;
      
      html = html.replace(/{{BENEFICIAR}}/g, beneficiar);
      html = html.replace(/{{NUME_SOT}}/g, numeSot);
      html = html.replace(/{{CNP_SOT}}/g, cnpSot);
    }

    const uploadDir = path.join(__dirname, '../uploads', String(cetatean.id));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `Cerere_${tip_dosar === 'alocatie' ? 'Alocatie' : 'Indemnizatie'}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    const options = { format: 'A4', margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' } };
    const pdfBuffer = await htmlToPdf.generatePdf({ content: html }, options);
    fs.writeFileSync(filePath, pdfBuffer);

    await Document.create({
      dosar_id: dosar_id,
      utilizator_id: cetatean.id,
      tip_document: 'alte', 
      nume_fisier: tip_dosar === 'alocatie' ? 'Cerere Acordare Alocație Stat' : 'Cerere Acordare Indemnizație',
      cale_fisier: `uploads/${cetatean.id}/${fileName}`,
      validat: true 
    });

    res.json({ mesaj: 'Cerere PDF generată și atașată cu succes.' });
  } catch (err) {
    console.error("Eroare la generarea cererii PDF:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ... (Adaugă acest block sub ruta de generare a cererii copil)

// ── POST /api/documente/genereaza-cerere-adoptie ────────────────────────────

// ── POST /api/documente/genereaza-cerere-adoptie ────────────────────────────
router.post('/genereaza-cerere-adoptie', verificaToken, async (req, res) => {
  try {
    const { dosar_id, date_cerere, date_adoptie, date_familie, semnatura_base64, semnatura_sot_base64 } = req.body;
    
    const dosar = await Dosar.findByPk(dosar_id);
    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit' });
    const cetatean = await Utilizator.findByPk(dosar.cetatean_id);

    const sablon = await SablonDocument.findOne({ where: { nume_sablon: 'Cerere_Adoptie' } });
    if (!sablon) return res.status(404).json({ eroare: 'Șablonul nu există' });

    let html = sablon.continut_html;
    html = html.replace(/{{NUME}}/g, cetatean.nume);
    html = html.replace(/{{PRENUME}}/g, cetatean.prenume);
    html = html.replace(/{{CNP}}/g, cetatean.cnp || '-');
    html = html.replace(/{{JUDET}}/g, cetatean.judet || '-');
    html = html.replace(/{{ORAS}}/g, cetatean.oras || '-');
    html = html.replace(/{{STRADA}}/g, date_cerere.strada || '-');
    html = html.replace(/{{TELEFON}}/g, cetatean.telefon || '-');

    let numeSot = date_familie.tipFamilie === 'integrala' && date_familie.numeSot ? date_familie.numeSot : '-';
    let cnpSot = date_familie.tipFamilie === 'integrala' && date_familie.cnpSot ? date_familie.cnpSot : '-';
    
    html = html.replace(/{{NUME_SOT}}/g, numeSot);
    html = html.replace(/{{CNP_SOT}}/g, cnpSot);
    html = html.replace(/{{GEN_COPIL}}/g, date_adoptie.gen_copil === 'indiferent' ? 'Indiferent (Băiat/Fată)' : date_adoptie.gen_copil);
    html = html.replace(/{{GREU_ADOPTABIL}}/g, date_adoptie.greu_adoptabil === 'Da' ? 'Da (Avem disponibilitate)' : 'Nu (Doar copii din profilul standard)');
    html = html.replace(/{{SEMNATURA_BASE64}}/g, semnatura_base64 || '');
    
    // Generăm un div alb gol ca imagine dacă nu există semnătura soțului, pentru a nu lăsa imaginea spartă în PDF
    const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    html = html.replace(/{{SEMNATURA_SOT_BASE64}}/g, semnatura_sot_base64 || emptyImage);
    html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));

    const uploadDir = path.join(__dirname, '../uploads', String(cetatean.id));
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `Cerere_Adoptie_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    const options = { format: 'A4', margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' } };
    const pdfBuffer = await htmlToPdf.generatePdf({ content: html }, options);
    fs.writeFileSync(filePath, pdfBuffer);

    await Document.create({
      dosar_id: dosar_id,
      utilizator_id: cetatean.id,
      tip_document: 'alte', 
      nume_fisier: 'Cerere de Evaluare pentru Adopție',
      cale_fisier: `uploads/${cetatean.id}/${fileName}`,
      validat: true 
    });

    res.json({ mesaj: 'Cerere Adopție generată cu succes.' });
  } catch (err) {
    console.error("Eroare cerere adopție:", err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;