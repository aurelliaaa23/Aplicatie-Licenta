const express = require('express');
const router = express.Router();
const { Dosar, Utilizator, Rol, Document, IstoricActiuni, ProgramareComisie, ProfilFunctionar, SolicitareMedicala } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Mapare pentru a salva corect denumirea departamentului pe Dosar
function mapTipLaDepartament(tip) {
  const map = {
    certificat_handicap: 'Evaluare Adulți (SECPAH)',
    adoptie: 'Adopții',
    plasament: 'Protecția Copilului',
    alocatie: 'Protecția Copilului',
    evaluare_adulti: 'Evaluare Adulți (SECPAH)',
    alte_servicii: 'Asistență Socială',
  };
  return map[tip] || 'Asistență Socială';
}

// Mapare flexibilă pentru a găsi funcționarii indiferent de variațiile de nume ale departamentelor
function getDepartamenteEligibile(tip) {
  if (tip === 'certificat_handicap' || tip === 'evaluare_adulti') {
    return ['Evaluare Adulți (SECPAH)', 'Evaluare Complexă', 'Adulți cu Handicap', 'evaluare adulti(secpah)', 'evaluare adulti', 'SECPAH'];
  }
  if (tip === 'adoptie') return ['Adopții'];
  if (tip === 'plasament' || tip === 'alocatie') return ['Protecția Copilului', 'Asistență Socială'];
  
  return ['Asistență Socială', 'General', 'Relații cu Publicul'];
}

// ── 1. GET /api/dosare/medici/solicitari (OBLIGATORIU SUS, DEASUPRA LA /:id) ──
router.get('/medici/solicitari', verificaToken, async (req, res) => {
  try {
    const solicitari = await SolicitareMedicala.findAll({
      where: { medic_id: req.utilizator.id },
      include: [
        { model: Dosar, as: 'dosar' },
        { model: Utilizator, as: 'cetatean' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(solicitari);
  } catch (err) {
    console.error("Eroare solicitari medici:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── 2. GET /api/dosare (PENTRU CETĂȚEAN, FUNCȚIONAR, PRIMĂRIE) ─────────────
router.get('/', verificaToken, async (req, res) => {
  try {
    const utilizatorLogat = await Utilizator.findByPk(req.utilizator.id, { include: [Rol] });
    const numeRol = utilizatorLogat.Rol.nume;

    let whereDosar = {};
    let undeCetatean = undefined;

    if (numeRol === 'cetățean') {
      whereDosar = { cetatean_id: utilizatorLogat.id };
    } else if (numeRol === 'funcționar') {
      whereDosar = { functionar_id: utilizatorLogat.id };
    } else if (numeRol === 'funcționar_primărie') {
      // Filtrăm strict după județul și orașul funcționarului de primărie
      undeCetatean = { judet: utilizatorLogat.judet };
      if (utilizatorLogat.oras) undeCetatean.oras = utilizatorLogat.oras;
    }

    const includeArray = [
      { model: Utilizator, as: 'functionar' }
    ];

    if (undeCetatean) {
      includeArray.push({ model: Utilizator, as: 'cetatean', where: undeCetatean, required: true });
    } else {
      includeArray.push({ model: Utilizator, as: 'cetatean' });
    }

    const dosare = await Dosar.findAll({
      where: whereDosar,
      include: includeArray,
      order: [['creat_la', 'DESC']]
    });

    res.json(dosare);
  } catch (err) {
    console.error('GET /dosare error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── 3. POST /api/dosare (CREARE DOSAR + FALLBACK DE ALOCARE) ────────────────
router.post('/', verificaToken, verificaRol('cetățean'), async (req, res) => {
  try {
    const { tip, descriere, prioritate } = req.body;
    const numar = `DGASPC-${Date.now()}`;
    const deptDosar = mapTipLaDepartament(tip);

    const cetatean = await Utilizator.findByPk(req.utilizator.id);
    const rolFunc = await Rol.findOne({ where: { nume: 'funcționar' } });
    
    let functionarAlocatId = null;

    if (rolFunc && cetatean) {
      const deptsPermise = getDepartamenteEligibile(tip);
      
      // PAS 1: Căutăm MAI ÎNTÂI funcționari din ACELAȘI JUDEȚ și departament
      let functionariEligibili = await Utilizator.findAll({
        where: {
          rol_id: rolFunc.id,
          activ: true,
          judet: cetatean.judet // Filtru geografic
        },
        include: [{
          model: ProfilFunctionar,
          as: 'profilFunctionar',
          where: { departament: { [Op.in]: deptsPermise } }
        }]
      });

      // PAS 2 (FALLBACK): Dacă nu există funcționari în același județ pentru acel departament, 
      // eliminăm filtrul geografic pentru a asigura totuși alocarea dosarului!
      if (functionariEligibili.length === 0) {
        functionariEligibili = await Utilizator.findAll({
          where: { rol_id: rolFunc.id, activ: true },
          include: [{
            model: ProfilFunctionar,
            as: 'profilFunctionar',
            where: { departament: { [Op.in]: deptsPermise } }
          }]
        });
      }

      // Verificăm numărul de dosare active pentru cei găsiți
      for (const f of functionariEligibili) {
        const activeCount = await Dosar.count({
          where: { 
            functionar_id: f.id, 
            status: { [Op.in]: ['depus', 'in_analiza', 'incomplet', 'in_asteptare_programare', 'programat_comisie'] } 
          }
        });
        
        // Alocăm primul funcționar care nu este sugrumat de muncă (mai puțin de 10 dosare active)
        if (activeCount < 10) {
          functionarAlocatId = f.id;
          break;
        }
      }

      // PAS 3 (ULTIMUL FALLBACK): Dacă absolut toți funcționarii sunt plini, îl forțăm pe primul din listă
      if (!functionarAlocatId && functionariEligibili.length > 0) {
        functionarAlocatId = functionariEligibili[0].id;
      }
    }

    const dosar = await Dosar.create({
      numar_dosar:  numar,
      tip,
      descriere,
      prioritate:   prioritate || 'normal',
      cetatean_id:  req.utilizator.id,
      functionar_id: functionarAlocatId,
      departament:  deptDosar,
      status:       'depus',
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar.id,
      actiune:       'Dosar creat și alocat automat',
      detalii:       `Tip: ${tip}, Dosar: ${numar}, Funcționar: ${functionarAlocatId ? 'Alocat cu succes' : 'Nealocat (lipsă funcționari departament)'}`,
      ip_adresa:     req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    res.status(201).json(dosar);
  } catch (err) {
    console.error('POST /dosare error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── 4. GET /api/dosare/:id (UN SINGUR DOSAR) ───────────────────────────────
router.get('/:id', verificaToken, async (req, res) => {
  try {
    const dosar = await Dosar.findByPk(req.params.id, {
      include: [
        { model: Utilizator, as: 'cetatean' },
        { model: Utilizator, as: 'functionar' },
        { model: Document },
        { model: ProgramareComisie }
      ]
    });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });
    res.json(dosar);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── 5. PATCH /api/dosare/:id/status (ACTUALIZARE STATUS DOSAR) ─────────────
router.patch('/:id/status', verificaToken, async (req, res) => {
  try {
    const { status, motiv_respingere, documente_suplimentare } = req.body;
    const dosar = await Dosar.findByPk(req.params.id, {
       include: [{ model: Utilizator, as: 'cetatean' }]
    });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    await dosar.update({ 
      status, 
      motiv_respingere: motiv_respingere || dosar.motiv_respingere,
      descriere: documente_suplimentare ? `${dosar.descriere}\n\n[SOLICITARE DOCUMENTE]:\n${documente_suplimentare}` : dosar.descriere
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar.id,
      actiune:       `Status schimbat în: ${status}`,
      detalii:       `Noul status: ${status}`,
      ip_adresa:     req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    res.json({ mesaj: 'Status actualizat', dosar });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── 6. POST /api/dosare/:id/notifica-medici ────────────────────────────────
router.post('/:id/notifica-medici', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { medici } = req.body; 
    
    const dosar = await Dosar.findByPk(dosarId, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    const cetatean = dosar.cetatean;

    for (const m of medici) {
      const medicCurent = await Utilizator.findByPk(m.id);
      if (!medicCurent) continue;

      await SolicitareMedicala.create({
        medic_id: medicCurent.id, 
        cetatean_id: cetatean.id,
        dosar_id: dosarId, 
        status: 'in_asteptare',
        observatii: m.tip
      });

      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: medicCurent.email,
        subject: `[DGASPC] Solicitare Medicală - ${cetatean.prenume} ${cetatean.nume}`,
        html: `<p>Stimate/ă Dr. ${medicCurent.nume},</p><p>Aveți o nouă solicitare medicală pentru pacientul ${cetatean.prenume} ${cetatean.nume}. Vă rugăm să accesați platforma pentru a completa documentele necesare.</p>`
      }).catch(console.error);
    }

    res.json({ mesaj: 'Medicii au fost notificați cu succes!' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── 7. POST /api/dosare/:id/scrisoare-medicala (SALVARE PDF MEDIC) ─────────
router.post('/:id/scrisoare-medicala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { nume, prenume, cnp, varsta, anamneza, diagnostic_principal, diagnostic_secundar, internari, deplasabil, semnatura_base64 } = req.body;

    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const fileName = `Scrisoare_Medicala_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);
    const stream = fs.createWriteStream(filePath);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);

    doc.fontSize(16).font('Helvetica-Bold').text('SCRISOARE MEDICALĂ', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Pacient: ${nume} ${prenume}, CNP: ${cnp}, Vârstă: ${varsta} ani`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('1. Anamneza:');
    doc.font('Helvetica').text(anamneza || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('2. Diagnostic principal:');
    doc.font('Helvetica').text(diagnostic_principal || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('3. Diagnostic secundar:');
    doc.font('Helvetica').text(diagnostic_secundar || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('4. Internări:');
    if (internari && internari.length > 0) {
      internari.forEach((int, i) => {
         doc.font('Helvetica').text(`${i+1}. ${int.unitate} (${int.data_inceput} - ${int.data_sfarsit}) | Diagnostic: ${int.diagnostic}`);
      });
    } else {
      doc.font('Helvetica').text('Fără internări declarate.');
    }
    doc.moveDown();
    doc.font('Helvetica-Bold').text('5. Starea de deplasabilitate:');
    doc.font('Helvetica').text(deplasabil || '-');
    doc.moveDown(2);
    doc.text(`Data completării: ${new Date().toLocaleDateString('ro-RO')}`);
    doc.moveDown();
    doc.text('Semnătura și parafa medicului:');
    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/(png|jpeg);base64,/, "");
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, { width: 150 });
    }
    doc.end();

    stream.on('finish', async () => {
      await Document.create({
        dosar_id: dosarId,
        utilizator_id: req.utilizator.id,
        tip_document: 'certificat_medical',
        nume_fisier: fileName,
        cale_fisier: `uploads/${fileName}`,
        semnatura_base64: semnatura_base64,
        validat: true 
      });

      const solicitare = await SolicitareMedicala.findOne({
         where: { dosar_id: dosarId, medic_id: req.utilizator.id }
      });
      if (solicitare) {
         await solicitare.update({ status: 'finalizata' });
      }

      res.json({ mesaj: 'Scrisoarea medicală a fost generată și atașată!' });
    });

  } catch (err) {
    console.error("Eroare generare scrisoare:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── 8. POST /api/dosare/:id/ancheta-sociala (SALVARE PDF PRIMĂRIE) ──────────
router.post('/:id/ancheta-sociala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { nume, prenume, cnp, conditii_locuit, situatie_familiala, venituri, recomandare, semnatura_base64 } = req.body;

    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const fileName = `Ancheta_Sociala_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);
    const stream = fs.createWriteStream(filePath);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);

    doc.fontSize(16).font('Helvetica-Bold').text('ANCHETĂ SOCIALĂ', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Subsemnatul/a, funcționar în cadrul compartimentului Asistență Socială, am efectuat ancheta socială pentru:`);
    doc.font('Helvetica-Bold').text(`Cetățean: ${nume} ${prenume}, CNP: ${cnp}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('1. Condiții de locuit:');
    doc.font('Helvetica').text(conditii_locuit || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('2. Situația familială:');
    doc.font('Helvetica').text(situatie_familiala || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('3. Situația veniturilor:');
    doc.font('Helvetica').text(venituri || '-');
    doc.moveDown();
    doc.font('Helvetica-Bold').text('4. Concluzii și Recomandări:');
    doc.font('Helvetica').text(recomandare || '-');
    doc.moveDown(2);
    doc.text(`Data completării: ${new Date().toLocaleDateString('ro-RO')}`);
    doc.moveDown(2);
    doc.text('Semnătura funcționar primărie:');
    if (semnatura_base64) {
      const base64Data = semnatura_base64.replace(/^data:image\/(png|jpeg);base64,/, "");
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, { width: 150 });
    }
    doc.end();

    stream.on('finish', async () => {
      await Document.create({
        dosar_id: dosarId,
        utilizator_id: req.utilizator.id,
        tip_document: 'ancheta_sociala',
        nume_fisier: fileName,
        cale_fisier: `uploads/${fileName}`,
        semnatura_base64: semnatura_base64,
        validat: true 
      });
      res.json({ mesaj: 'Ancheta socială a fost generată și atașată dosarului!' });
    });

  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── 9. POST /api/dosare/:id/programeaza ────────────────────────────────────
router.post('/:id/programeaza', verificaToken, async (req, res) => {
  try {
    const { data_programare, ora } = req.body;
    const dosar = await Dosar.findByPk(req.params.id);
    if(!dosar) return res.status(404).json({ eroare: 'Dosar negasit' });

    const data_ora = new Date(`${data_programare}T${ora}:00`);

    await ProgramareComisie.create({
      dosar_id: dosar.id,
      funcționar_id: dosar.functionar_id, 
      tip_comisie: dosar.tip,
      data_ora_programare: data_ora, 
      locatie: 'Sediul Central DGASPC',
      status: 'programat' 
    });

    await dosar.update({ status: 'programat_comisie' });
    res.json({ mesaj: 'Programarea a fost înregistrată!' });
  } catch (err) {
     res.status(500).json({ eroare: err.message });
  }
});

// ── 10. POST /api/dosare/:id/finalizare-comisie (GENEREAZĂ CERTIFICAT/RESPINGE) ──
router.post('/:id/finalizare-comisie', verificaToken, async (req, res) => {
  try {
    const { actiune, grad, revizuire_luni, motiv } = req.body;
    const dosar = await Dosar.findByPk(req.params.id, {
      include: [{ model: Utilizator, as: 'cetatean' }]
    });
    
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    // CAZ 1: COMISIA RESPINGE DOSARUL
    if (actiune === 'respinge') {
      await dosar.update({ status: 'respins', motiv_respingere: motiv });
      
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: dosar.cetatean.email,
        subject: `[DGASPC] Decizie Comisie - Dosar Respins nr. ${dosar.numar_dosar}`,
        html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p>
               <p>Dosarul dumneavoastră a fost evaluat de comisia de specialitate și a fost <strong>RESPINS</strong>.</p>
               <div style="background:#fce8e6; padding:15px; border-left:4px solid #c5221f; margin:20px 0;">
                 <p style="margin:0; color:#c5221f;"><strong>Motivul respingerii:</strong><br/>${motiv}</p>
               </div>
               <p>Pentru mai multe detalii, vă rugăm să accesați contul dumneavoastră din platformă.</p>`
      }).catch(console.error);

      await IstoricActiuni.create({
        utilizator_id: req.utilizator.id, dosar_id: dosar.id, actiune: 'Dosar respins de comisie', detalii: `Motiv: ${motiv}`, ip_adresa: req.ip
      }).catch(e => console.error(e));

      return res.json({ mesaj: 'Dosar respins! Cetățeanul a fost notificat.' });
    }

    // CAZ 2: COMISIA APROBĂ DOSARUL ȘI GENEREAZĂ CERTIFICATUL
    if (actiune === 'aproba') {
      const fs = require('fs');
      const path = require('path');
      const PDFDocument = require('pdfkit');

      const dir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      
      const fileName = `Certificat_Handicap_${Date.now()}.pdf`;
      const filePath = path.join(dir, fileName);
      const stream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(stream);

      // Generare vizuală PDF (Certificat)
      doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICAT', { align: 'center' });
      doc.fontSize(14).text('de încadrare în grad de handicap', { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(12).font('Helvetica').text('Comisia de evaluare persoane adulte cu handicap, constituită în temeiul Legii nr.448/2006, privind protecția și promovarea drepturilor persoanelor cu handicap, republicată, cu modificările și completările ulterioare, evaluând dosarul și propunerea serviciului de evaluare complexă a persoanelor adulte cu handicap:', { align: 'justify' });
      doc.moveDown();
      
      doc.font('Helvetica-Bold').text(`Privind pe domnul/doamna: ${dosar.cetatean.prenume} ${dosar.cetatean.nume}`);
      doc.text(`C.N.P.: ${dosar.cetatean.cnp || '..........................'}`);
      doc.text(`Domiciliul: Județ/Oraș ${dosar.cetatean.judet || ''} ${dosar.cetatean.oras || ''}`);
      doc.moveDown();

      doc.font('Helvetica').text('Stabilește următoarele:');
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`1. Se încadrează în gradul de handicap: ${grad ? grad.toUpperCase() : 'NESPECIFICAT'}`);
      
      let valabilitateText = "Permanent (Nelimitat)";
      let dataRevizuire = "Nu este cazul";
      
      if (revizuire_luni && revizuire_luni !== 'nelimitat') {
        const data = new Date();
        data.setMonth(data.getMonth() + parseInt(revizuire_luni));
        valabilitateText = `${revizuire_luni} luni`;
        dataRevizuire = data.toLocaleDateString('ro-RO');
      }

      doc.text(`2. Valabilitate: ${valabilitateText}`);
      doc.text(`3. Termen de revizuire: ${dataRevizuire}`);
      doc.moveDown(4);
      doc.text('Președinte Comisie,', { align: 'right' });
      doc.font('Helvetica').text('Semnătură electronică validată', { align: 'right', size: 10, color: 'gray' });
      doc.end();

      stream.on('finish', async () => {
        // Atașează certificatul la dosar
        await Document.create({
          dosar_id: dosar.id, utilizator_id: req.utilizator.id, tip_document: 'decizie',
          nume_fisier: 'Certificat_Incadrare_Handicap.pdf', cale_fisier: `uploads/${fileName}`, validat: true
        });
        
        await dosar.update({ status: 'aprobat' });

        await IstoricActiuni.create({
          utilizator_id: req.utilizator.id, dosar_id: dosar.id, actiune: 'Dosar aprobat de comisie', detalii: `Certificat emis. Grad: ${grad}`, ip_adresa: req.ip
        }).catch(e => console.error(e));

        // Trimite email cetățeanului
        await mailer.sendMail({
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: dosar.cetatean.email,
          subject: `[DGASPC] Certificat de Handicap Emis - Dosar ${dosar.numar_dosar}`,
          html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p>
                 <p>Vă informăm cu bucurie că dosarul a fost <strong>APROBAT</strong> de comisia de evaluare.</p>
                 <p>Certificatul dumneavoastră de încadrare în grad de handicap a fost emis în format electronic. Îl puteți vizualiza și descărca direct din secțiunea "Documente atașate" a dosarului dumneavoastră din platformă.</p>`
        }).catch(console.error);

        res.json({ mesaj: 'Certificat generat și dosar aprobat cu succes!' });
      });
    }
  } catch (err) {
    console.error("Eroare la finalizare comisie:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── 11. PATCH /api/dosare/document/:docId/aprobare (APROBARE DOCUMENT) ─────
router.patch('/document/:docId/aprobare', verificaToken, async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.docId);
    if (!doc) return res.status(404).json({ eroare: 'Documentul nu a fost găsit' });

    await doc.update({ validat: true });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id: doc.dosar_id, actiune: 'Document aprobat', detalii: `Documentul ${doc.nume_fisier || doc.tip_document} a fost validat.`, ip_adresa: req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    res.json({ mesaj: 'Document validat cu succes' });
  } catch (err) {
    console.error("Eroare la aprobare document:", err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;