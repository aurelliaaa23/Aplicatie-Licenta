const router = require('express').Router();
const path = require('path');
const { Document, Dosar, IstoricActiuni } = require('../models');
const { verificaToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// POST /api/documente/upload — încarcă fișier
router.post('/upload', verificaToken, upload.single('fisier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ eroare: 'Niciun fișier primit' });
    const { dosar_id, tip_document } = req.body;

    const doc = await Document.create({
      dosar_id, utilizator_id: req.utilizator.id,
      tip_document,
      nume_fisier: req.file.originalname,
      cale_fisier: req.file.path,
      marime_bytes: req.file.size,
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id,
      actiune: 'Document încărcat',
      detalii: { tip_document, nume_fisier: req.file.originalname },
      adresa_ip: req.ip,
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// POST /api/documente/semnatura — salvare semnătură olografă
router.post('/semnatura', verificaToken, async (req, res) => {
  try {
    const { dosar_id, semnatura_base64 } = req.body;
    if (!semnatura_base64) return res.status(400).json({ eroare: 'Semnătură lipsă' });

    const doc = await Document.create({
      dosar_id,
      nume_fisier: 'Cerere_Evaluare_Handicap.pdf',
      cale_fisier: `uploads/${numeFisier}`,
      tip_document: 'cerere_evaluare',       // VARCHAR liber
      status_document: 'incarcat',
      semnat_digital: !!semnatura_base64,
      date_semnatura: semnatura_base64 ? JSON.stringify({ timestamp: new Date(), utilizator_id: user.id }) : null,
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id,
      actiune: 'Semnătură electronică aplicată',
      adresa_ip: req.ip,
    });

    res.status(201).json({ mesaj: 'Semnătură salvată cu succes', id: doc.id });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

const PDFDocument = require('pdfkit');
const fs = require('fs');

// Funcție utilitară pentru a scoate diacriticele din datele utilizatorului
function eliminaDiacritice(str) {
  if (!str) return '';
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ș/g, 's').replace(/ț/g, 't')
    .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/Ș/g, 'S').replace(/Ț/g, 'T')
    .replace(/Ă/g, 'A').replace(/Â/g, 'A').replace(/Î/g, 'I');
}

// Calculează vârsta din CNP
function calculeazaVarsta(cnp) {
  if (!cnp || cnp.length !== 13) return '';
  const s = parseInt(cnp.charAt(0));
  let an = parseInt(cnp.substring(1, 3));
  if (s === 1 || s === 2) an += 1900;
  else if (s === 5 || s === 6) an += 2000;
  else an += 1900;
  return new Date().getFullYear() - an;
}

// ── POST /api/documente/genereaza-cerere-handicap ─────────────────────────
router.post('/genereaza-cerere-handicap', verificaToken, async (req, res) => {
  try {
    const { dosar_id, date_cerere, semnatura_base64 } = req.body;
    const user = req.utilizator;

    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

    const numeFisier = `Cerere_Handicap_${dosar_id}_${Date.now()}.pdf`;
    const caleAbsoluta = path.join(uploadPath, numeFisier);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(caleAbsoluta);
    doc.pipe(stream);

    // Preluăm și "curățăm" datele de diacritice
    const numeComplet = eliminaDiacritice(`${user.nume} ${user.prenume}`);
    const serieCi = eliminaDiacritice(date_cerere.serie_ci);
    const numarCi = date_cerere.numar_ci;
    const cnp = user.cnp;
    const judet = eliminaDiacritice(date_cerere.judet);
    const oras = eliminaDiacritice(date_cerere.oras);
    const stradaDetaliata = eliminaDiacritice(date_cerere.strada);
    const telefon = user.telefon;
    const email = eliminaDiacritice(user.email);

    let tipT = 'Dosar Nou';
    if (date_cerere.tip_cerere === 'reevaluare_expirat') tipT = 'Reevaluare pentru dosar expirat';
    if (date_cerere.tip_cerere === 'reevaluare_agravare') tipT = 'Reevaluare pentru agravare stare de sanatate';
    tipT = eliminaDiacritice(tipT);

    // --- STRUCTURĂ TEMPLATE OFICIAL ---

    // Header
    doc.fontSize(12).font('Helvetica-Bold')
       .text('SERVICIUL DE EVALUARE COMPLEXA A PERSOANELOR ADULTE CU HANDICAP', { align: 'center' });
    doc.moveDown(3);

    // Titlu
    doc.fontSize(12).font('Helvetica-Bold')
       .text('DOMNULE/DOAMNA DIRECTOR,');
    doc.moveDown(1.5);

    // Paragraf principal
    doc.fontSize(11).font('Helvetica')
       .text(`Subsemnatul(a) ${numeComplet} si legitimat(a) cu CI/BI seria ${serieCi} nr. ${numarCi} avand CNP ${cnp} cu domiciliul in orasul/localitatea ${oras}, judet/sector ${judet}, str. ${stradaDetaliata}, telefon ${telefon}, e-mail ${email} solicit evaluarea in cadrul Serviciului de Evaluare Complexa a Persoanelor Adulte cu Handicap, in vederea:`, {
         align: 'justify',
         lineGap: 4
       });
    
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text(tipT, { align: 'center' });
    doc.moveDown(1.5);

    // Declarații
    doc.fontSize(11).font('Helvetica')
       .text('Declar pe proprie raspundere ca datele declarate in prezenta cerere sunt corecte si complete si ca documentele depuse sunt conforme cu originalul.', { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);
    doc.text('Sunt de acord ca datele mele cu caracter personal sa fie prelucrate de DGASPC in conformitate cu reglementarile GDPR.', { align: 'justify', lineGap: 3 });
    doc.moveDown(3);

    // Data și loc de semnătură pe aceeași linie
    const yBazaSemnatura = doc.y;
    doc.text(`Data: ${new Date().toLocaleDateString('ro-RO')}`, 50, yBazaSemnatura);
    doc.text('Semnatura:', 350, yBazaSemnatura);

    // Inserare imagine semnătură (dacă există)
    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, 340, yBazaSemnatura + 10, { width: 120 });
    }

    doc.moveDown(6);

    // Footer / Notă GDPR
    doc.fontSize(8).font('Helvetica')
       .text('Datele dumneavoastra cu caracter personal sunt prelucrate de D.G.A.S.P.C. in conformitate cu art. 6 din Regulamentul UE 679/2016 in scopul indeplinirii atributiilor legale. Datele pot fi dezvaluite unor terti in baza unui temei legal justificat. Va puteti exercita drepturile prevazute in Regulamentul UE 679/2016, printr-o cerere scrisa, semnata si datata transmisa pe adresa D.G.A.S.P.C.', 50, doc.page.height - 100, {
         align: 'justify',
         lineGap: 1.5
       });

    doc.end();

    stream.on('error', (err) => {
      console.error('Stream error cerere handicap:', err);
      if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la scrierea fișierului PDF.' });
    });

    stream.on('finish', async () => {
      try {
        await Document.create({
           dosar_id,
           utilizator_id: user.id,
           nume_fisier: 'Cerere_Evaluare_Handicap.pdf',
           cale_fisier: `uploads/${numeFisier}`,
           tip_document: 'alte' 
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

// ── POST /api/documente/genereaza-scrisoare-medicala ──────────────────────
router.post('/genereaza-scrisoare-medicala', verificaToken, async (req, res) => {
  try {
    const { solicitare_id, dosar_id, cetatean, anamneza, diag_princ, diag_sec, internari, deplasabil, semnatura_base64 } = req.body;
    const medic = req.utilizator;

    const { SolicitareMedicala } = require('../models');

    const uploadPath = path.join(__dirname, '../uploads');
    const numeFisier = `Scrisoare_Medicala_${dosar_id}_${Date.now()}.pdf`;
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(path.join(uploadPath, numeFisier));
    doc.pipe(stream);

    // Date prelucrate fără diacritice
    const anamnezaClean = eliminaDiacritice(anamneza);
    const princClean = eliminaDiacritice(diag_princ);
    const secClean = eliminaDiacritice(diag_sec);

    doc.fontSize(14).font('Helvetica-Bold').text('SCRISOARE MEDICALA', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).font('Helvetica')
       .text(`Numele ${cetatean.nume}, Prenumele ${cetatean.prenume}, CNP ${cetatean.cnp}, varsta ${calculeazaVarsta(cetatean.cnp)} ani.`);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('1. Anamneza');
    doc.font('Helvetica').text('- antecedente personale patologice');
    doc.text(anamnezaClean, { indent: 10 });
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('2. Diagnosticul medical');
    doc.font('Helvetica').text(`- principal: ${princClean}`);
    doc.text(`- altele: ${secClean}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('3. Internari in spital (data, institutia emitenta si diagnosticul la iesirea din spital)');
    doc.font('Helvetica');
    if (internari && internari.length > 0) {
      internari.forEach(int => {
        doc.text(`- Perioada: ${int.de_la} - ${int.pana_la} | Institutia: ${eliminaDiacritice(int.spital)} | Diagnostic: ${eliminaDiacritice(int.diagnostic)}`, { indent: 10 });
      });
    } else {
      doc.text('- Fara internari recente.', { indent: 10 });
    }
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('4. Mobilitate');
    doc.font('Helvetica').text(`Persoana - ${deplasabil === 'da' ? 'este deplasabila (deplasare autonoma sau sprijin din partea unei persoane / cu dispozitive)' : 'nu este deplasabila (nu poate fi deplasat ajutat de o persoana sau cu scaunul rulant)'}`);
    doc.moveDown(3);

    const yBazaSemnatura = doc.y;
    doc.text(`Data completarii: ${new Date().toLocaleDateString('ro-RO')}`, 50, yBazaSemnatura);
    doc.text('Semnatura medicului de familie:', 300, yBazaSemnatura);

    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, "");
      doc.image(Buffer.from(base64Data, 'base64'), 320, yBazaSemnatura + 10, { width: 120 });
    }

    doc.end();

    stream.on('error', (err) => {
      console.error('Stream error scrisoare medicala:', err);
      if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la scrierea fișierului PDF.' });
    });

    stream.on('finish', async () => {
      try {
        await Document.create({
           dosar_id, utilizator_id: medic.id,
           nume_fisier: `Scrisoare_Med_Dr_${medic.nume}.pdf`,
           cale_fisier: `uploads/${numeFisier}`, tip_document: 'certificat_medical' 
        });
        if (solicitare_id) {
          await SolicitareMedicala.update({ status: 'finalizat' }, { where: { id: solicitare_id } });
        }
        res.json({ mesaj: 'Scrisoare generată cu succes!' });
      } catch (dbErr) {
        console.error('Eroare DB după generare scrisoare:', dbErr);
        if (!res.headersSent) res.status(500).json({ eroare: dbErr.message });
      }
    });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/documente/genereaza-referat-specialist ──────────────────────
router.post('/genereaza-referat-specialist', verificaToken, async (req, res) => {
  try {
    const {
      solicitare_id, dosar_id, cetatean, medic,
      diagnostic, istoric, stadiu, tip_boala,
      tratament, recomandari, speranta_vindecare,
      semnatura_base64
    } = req.body;

    const { SolicitareMedicala } = require('../models');

    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

    const numeFisier = `Referat_Specialist_${dosar_id}_${Date.now()}.pdf`;
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(path.join(uploadPath, numeFisier));
    doc.pipe(stream);

    // Valori afișate pentru câmpurile cu enum
    const stadiuLabel = { incipient: 'Incipient', avansat: 'Avansat', terminal: 'Terminal' };
    const tipBoalaLabel = { cronic: 'Cronica', acut: 'Acuta' };
    const sperantaLabel = {
      mare: 'Mare (prognostic favorabil, recuperare completa probabila)',
      medie: 'Medie (prognostic rezervat partial, recuperare posibila cu tratament)',
      rezervat: 'Rezervat (prognostic incert, evolutie imprevizibila)',
      nerecuperabil: 'Nerecuperabil (afectiune ireversibila, fara perspectiva de recuperare)',
    };

    // ── ANTET ──
    doc.fontSize(13).font('Helvetica-Bold')
       .text('REFERAT DE SPECIALITATE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica')
       .text(`Specialitate: ${eliminaDiacritice(medic.specialitate || '')}`, { align: 'center' });
    doc.moveDown(2);

    // ── DATE PACIENT ──
    doc.fontSize(12).font('Helvetica-Bold').text('DATE PACIENT');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Numele: ${eliminaDiacritice(cetatean.nume)}, Prenumele: ${eliminaDiacritice(cetatean.prenume)}`);
    doc.text(`CNP: ${cetatean.cnp}, Varsta: ${calculeazaVarsta(cetatean.cnp)} ani`);
    doc.text(`Telefon: ${cetatean.telefon || '—'}`);
    doc.text(`Email: ${eliminaDiacritice(cetatean.email || '')}`);
    doc.moveDown(1.5);

    // ── 1. DIAGNOSTIC ──
    doc.fontSize(12).font('Helvetica-Bold').text('1. Diagnostic');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(eliminaDiacritice(diagnostic), { indent: 10, lineGap: 3 });
    doc.moveDown(1);

    // ── 2. ISTORIC MEDICAL ──
    doc.fontSize(12).font('Helvetica-Bold').text('2. Istoric Medical');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(eliminaDiacritice(istoric), { indent: 10, lineGap: 3 });
    doc.moveDown(1);

    // ── 3. STADIU ──
    doc.fontSize(12).font('Helvetica-Bold').text('3. Stadiu Boala');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(stadiuLabel[stadiu] || stadiu, { indent: 10 });
    doc.moveDown(1);

    // ── 4. TIP BOALĂ ──
    doc.fontSize(12).font('Helvetica-Bold').text('4. Tip Boala');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(tipBoalaLabel[tip_boala] || tip_boala, { indent: 10 });
    doc.moveDown(1);

    // ── 5. TRATAMENT ──
    doc.fontSize(12).font('Helvetica-Bold').text('5. Tratament');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(eliminaDiacritice(tratament), { indent: 10, lineGap: 3 });
    doc.moveDown(1);

    // ── 6. RECOMANDĂRI ──
    doc.fontSize(12).font('Helvetica-Bold').text('6. Recomandari');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica')
       .text(recomandari ? eliminaDiacritice(recomandari) : 'Fara recomandari suplimentare.', { indent: 10, lineGap: 3 });
    doc.moveDown(1);

    // ── 7. SPERANȚĂ DE VINDECARE ──
    doc.fontSize(12).font('Helvetica-Bold').text('7. Speranta de Vindecare');
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica')
       .text(sperantaLabel[speranta_vindecare] || speranta_vindecare, { indent: 10 });
    doc.moveDown(3);

    // ── SEMNĂTURĂ ──
    const yBazaSemnatura = doc.y;
    doc.fontSize(11).font('Helvetica')
       .text(`Data: ${new Date().toLocaleDateString('ro-RO')}`, 50, yBazaSemnatura);
    doc.text(
      `Medic specialist: Dr. ${eliminaDiacritice(medic.prenume)} ${eliminaDiacritice(medic.nume)}`,
      300, yBazaSemnatura
    );
    doc.text(`Specialitate: ${eliminaDiacritice(medic.specialitate || '')}`, 300, yBazaSemnatura + 15);
    doc.text('Semnatura:', 300, yBazaSemnatura + 30);

    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/png;base64,/, '');
      doc.image(Buffer.from(base64Data, 'base64'), 300, yBazaSemnatura + 45, { width: 130 });
    }

    doc.end();

    stream.on('error', (err) => {
      console.error('Stream error referat specialist:', err);
      if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la scrierea fișierului PDF.' });
    });

    stream.on('finish', async () => {
      try {
        await Document.create({
          dosar_id,
          utilizator_id: req.utilizator.id,
          nume_fisier: `Referat_Specialist_Dr_${eliminaDiacritice(medic.nume)}.pdf`,
          cale_fisier: `uploads/${numeFisier}`,
          tip_document: 'certificat_medical',
        });
        if (solicitare_id) {
          await SolicitareMedicala.update(
            { status: 'finalizat' },
            { where: { id: solicitare_id } }
          );
        }
        res.json({ mesaj: 'Referat de specialitate generat cu succes!' });
      } catch (dbErr) {
        console.error('Eroare DB după generare referat:', dbErr);
        if (!res.headersSent) res.status(500).json({ eroare: dbErr.message });
      }
    });

  } catch (err) {
    console.error('Eroare la generare referat specialist:', err);
    if (!res.headersSent) res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;