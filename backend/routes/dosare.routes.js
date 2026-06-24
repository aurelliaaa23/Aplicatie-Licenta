const express = require('express');
const router = express.Router();
const { Dosar, Utilizator, Rol, Document, IstoricActiuni, ProgramareComisie, ProfilFunctionar, SolicitareMedicala, SablonDocument } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const htmlToPdf = require('html-pdf-node');
const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function mapTipLaDepartament(tip) {
  const map = {
    certificat_handicap: 'Evaluare Adulți (SECPAH)',
    adoptie: 'Adopții',
    plasament: 'Protecția Copilului',
    alocatie: 'Protecția Copilului',
    alte_servicii: 'Asistență Socială',
  };
  return map[tip] || 'Asistență Socială';
}

function getDepartamenteEligibile(tip) {
  if (tip === 'certificat_handicap' || tip === 'evaluare_adulti') {
    return ['Evaluare Adulți (SECPAH)', 'Evaluare Complexă', 'Adulți cu Handicap', 'evaluare adulti(secpah)', 'evaluare adulti', 'SECPAH'];
  }
  if (tip === 'adoptie') return ['Adopții'];
  if (tip === 'plasament' || tip === 'alocatie') return ['Protecția Copilului', 'Asistență Socială'];
  
  return ['Asistență Socială', 'General', 'Relații cu Publicul'];
}

// Funcție universală pentru înlocuirea variabilelor HTML
async function genereazaDinSablon(nume_sablon, date_inlocuire, caleFisier) {
  try{
  const sablon = await SablonDocument.findOne({ where: { nume_sablon } });
  if (!sablon) throw new Error(`Șablonul ${nume_sablon} nu există în baza de date!`);

  let html = sablon.continut_html;
  for (const [key, value] of Object.entries(date_inlocuire)) {
    const regex = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
    html = html.replace(regex, value || '-');
  }
  html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));

  const options = { format: 'A4', margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' } };
  const pdfBuffer = await htmlToPdf.generatePdf({ content: html }, options);
  fs.writeFileSync(caleFisier, pdfBuffer);
}catch (error) {
    console.error(`❌ Eroare internă la PDF (${nume_sablon}):`, error.message);
    throw error; // Aruncăm eroarea mai departe pentru a fi trimisă frontend-ului
  }
}

// ── 1. GET /api/dosare/medici/solicitari (REPARAT: SORTARE DUPĂ creat_la) ──
router.get('/medici/solicitari', verificaToken, async (req, res) => {
  try {
    const solicitari = await SolicitareMedicala.findAll({
      where: { medic_id: req.utilizator.id },
      include: [{ all: true }],
      order: [['creat_la', 'DESC']] // FIX: Sequelize crapă dacă pui 'createdAt' dar tabelul folosește aliasul 'creat_la'
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
      undeCetatean = { judet: utilizatorLogat.judet || 'Nespecificat' };
      if (utilizatorLogat.oras) {
        undeCetatean.oras = { [Op.substring]: utilizatorLogat.oras.trim() };
      }
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

// ── 3. POST /api/dosare (CREARE DOSAR + E-MAIL PRIMĂRIE) ───────────────────
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
      
      let functionariEligibili = await Utilizator.findAll({
        where: { rol_id: rolFunc.id, activ: true, judet: cetatean.judet },
        include: [{
          model: ProfilFunctionar, as: 'profilFunctionar',
          where: { departament: { [Op.in]: deptsPermise } }
        }]
      });

      if (functionariEligibili.length === 0) {
        functionariEligibili = await Utilizator.findAll({
          where: { rol_id: rolFunc.id, activ: true },
          include: [{
            model: ProfilFunctionar, as: 'profilFunctionar',
            where: { departament: { [Op.in]: deptsPermise } }
          }]
        });
      }

      for (const f of functionariEligibili) {
        const activeCount = await Dosar.count({
          where: { 
            functionar_id: f.id, 
            status: { [Op.in]: ['depus', 'in_analiza', 'incomplet', 'in_asteptare_programare', 'programat_comisie'] } 
          }
        });
        if (activeCount < 10) { functionarAlocatId = f.id; break; }
      }

      if (!functionarAlocatId && functionariEligibili.length > 0) {
        functionarAlocatId = functionariEligibili[0].id;
      }
    }

    const dosar = await Dosar.create({
      numar_dosar:  numar,
      tip, descriere, prioritate: prioritate || 'normal',
      cetatean_id:  req.utilizator.id,
      functionar_id: functionarAlocatId,
      departament:  deptDosar,
      status:       'depus',
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id: dosar.id, actiune: 'Dosar creat și alocat automat',
      detalii: `Tip: ${tip}, Dosar: ${numar}, Funcționar: ${functionarAlocatId ? 'Alocat' : 'Nealocat'}`,
      adresa_ip: req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    // FIX: NOTIFICĂM AUTOMAT PRIMĂRIA CĂ ARE O NOUĂ ANCHETĂ DE FĂCUT!
    try {
      const rolPrimarie = await Rol.findOne({ where: { nume: 'funcționar_primărie' } });
      if (rolPrimarie && cetatean.judet && cetatean.oras) {
        const primarii = await Utilizator.findAll({
          where: { 
            rol_id: rolPrimarie.id, 
            activ: true, 
            judet: cetatean.judet,
            oras: { [Op.substring]: cetatean.oras }
          }
        });
        for (const primarie of primarii) {
          await mailer.sendMail({
            from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
            to: primarie.email,
            subject: `[DGASPC] Solicitare Anchetă Socială - Dosar ${numar}`,
            html: `<p>Bună ziua,</p>
                   <p>A fost depus un nou dosar (<strong>${numar}</strong>) de către cetățeanul <strong>${cetatean.prenume} ${cetatean.nume}</strong> din localitatea dumneavoastră.</p>
                   <p>Vă rugăm să accesați platforma pentru a efectua și încărca Ancheta Socială aferentă acestui dosar.</p>`
          }).catch(err => console.error("Eroare trimitere email primarie:", err));
        }
      }
    } catch(errMail) { console.error("Eroare cautare primarii:", errMail); }

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
    const dosar = await Dosar.findByPk(req.params.id, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    const updateData = {};
    if (status) updateData.status = status;
    if (motiv_respingere !== undefined) updateData.motiv_respingere = motiv_respingere;
    if (documente_suplimentare) {
      updateData.descriere = `${dosar.descriere || ''}\n\n[SOLICITARE DOCUMENTE]:\n${documente_suplimentare}`;
    }

    await dosar.update(updateData);

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id: dosar.id, actiune: `Status schimbat în: ${status}`,
      detalii: `Noul status: ${status}`, adresa_ip: req.ip,
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

    for (const m of medici) {
      try {
        const medicCurent = await Utilizator.findByPk(m.id);
        if (!medicCurent) continue;

        await SolicitareMedicala.create({
          medic_id: medicCurent.id, cetatean_id: dosar.cetatean.id, dosar_id: dosarId, 
          status: 'in_asteptare', observatii: m.tip
        });

        await mailer.sendMail({
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: medicCurent.email,
          subject: `[DGASPC] Solicitare Medicală - ${dosar.cetatean.prenume} ${dosar.cetatean.nume}`,
          html: `<p>Stimate/ă Dr. ${medicCurent.nume},</p><p>Aveți o nouă solicitare medicală pentru pacientul ${dosar.cetatean.prenume} ${dosar.cetatean.nume}. Vă rugăm să accesați platforma pentru a completa documentele necesare.</p>`
        }).catch(console.error);
      } catch (errInner) { console.error("Eroare procesare medic:", errInner); }
    }
    res.json({ mesaj: 'Medicii au fost notificați cu succes!' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

// ── POST /api/dosare/:id/scrisoare-medicala (HTML TEMPLATE) ────────────────
router.post('/:id/scrisoare-medicala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { tip_scrisoare, ...payloadFront } = req.body;
    // Numele șablonului depinde de selecția medicului din front
    const nume_sablon = tip_scrisoare === 'specialist' ? 'Referat_Medic_Specialist' : 'Scrisoare_Medic_Familie';

    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${nume_sablon}_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);

    // Daca e medic de familie si are array de internari, convertim la HTML
    if (tip_scrisoare !== 'specialist' && payloadFront.internari && Array.isArray(payloadFront.internari)) {
      if (payloadFront.internari.length === 0) payloadFront.internari_html = '<li>Fără internări declarate.</li>';
      else {
        payloadFront.internari_html = payloadFront.internari.map(i => 
          `<li>${i.unitate} (${i.data_inceput} - ${i.data_sfarsit}) | Diagnostic: ${i.diagnostic}</li>`
        ).join('');
      }
    }

    await genereazaDinSablon(nume_sablon, payloadFront, filePath);

    await Document.create({
      dosar_id: dosarId, utilizator_id: req.utilizator.id, tip_document: 'certificat_medical',
      nume_fisier: fileName, cale_fisier: `uploads/${req.utilizator.id}/${fileName}`, status_document: 'incarcat', 
    });

    const solicitare = await SolicitareMedicala.findOne({ where: { dosar_id: dosarId, medic_id: req.utilizator.id } });
    if (solicitare) await solicitare.update({ status: 'finalizata' });

    res.json({ mesaj: 'Documentul medical a fost generat din șablon și atașat!' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

// ── POST /api/dosare/:id/ancheta-sociala (HTML TEMPLATE) ───────────────────
router.post('/:id/ancheta-sociala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const payloadFront = req.body;

    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `Ancheta_Sociala_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);

    await genereazaDinSablon('Ancheta_Sociala', payloadFront, filePath);

    await Document.create({
      dosar_id: dosarId, utilizator_id: req.utilizator.id, tip_document: 'ancheta_sociala',
      nume_fisier: fileName, cale_fisier: `uploads/${req.utilizator.id}/${fileName}`, status_document: 'incarcat' 
    });
    res.json({ mesaj: 'Ancheta socială a fost generată din șablon și atașată dosarului!' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

// ── 10. POST /api/dosare/:id/finalizare-comisie (GENEREAZĂ CERTIFICAT/RESPINGE) ──
// ── 10. POST /api/dosare/:id/finalizare-comisie ────────────────────────────
router.post('/:id/finalizare-comisie', verificaToken, async (req, res) => {
  try {
    const { actiune, grad, revizuire_luni, motiv } = req.body;
    const dosar = await Dosar.findByPk(req.params.id, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    if (actiune === 'respinge') {
      await dosar.update({ status: 'respins', motiv_respingere: motiv });
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`, to: dosar.cetatean.email,
        subject: `[DGASPC] Decizie Comisie - Dosar Respins nr. ${dosar.numar_dosar}`,
        html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p><p>Dosarul a fost <strong>RESPINS</strong>.</p><div style="background:#fce8e6; padding:15px; border-left:4px solid #c5221f; margin:20px 0;"><p style="margin:0; color:#c5221f;"><strong>Motivul respingerii:</strong><br/>${motiv}</p></div>`
      }).catch(console.error);
      return res.json({ mesaj: 'Dosar respins! Cetățeanul a fost notificat.' });
    }

    if (actiune === 'aproba') {
      const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const numeFisier = `Certificat_Handicap_${Date.now()}.pdf`; 
      const caleAbsoluta = path.join(dir, numeFisier);
      
      let valabilitateText = "Permanent (Nelimitat)"; 
      let dataRevizuire = "Nu este cazul";
      
      if (revizuire_luni && revizuire_luni !== 'nelimitat') {
        const data = new Date(); data.setMonth(data.getMonth() + parseInt(revizuire_luni));
        valabilitateText = `${revizuire_luni} luni`; 
        dataRevizuire = data.toLocaleDateString('ro-RO');
      }

      // Împachetăm datele extrase pentru șablonul HTML
      const payloadSablon = {
        nume: dosar.cetatean.nume,
        prenume: dosar.cetatean.prenume,
        cnp: dosar.cetatean.cnp || '-',
        judet: dosar.cetatean.judet || '-',
        oras: dosar.cetatean.oras || '-',
        grad: grad ? grad.toUpperCase() : 'NESPECIFICAT',
        valabilitate: valabilitateText,
        revizuire: dataRevizuire
      };

      // Generăm certificatul elegant prin HTML
      await genereazaDinSablon('Certificat_Incadrare_Handicap', payloadSablon, caleAbsoluta);

      await Document.create({ 
        dosar_id: dosar.id, 
        tip_document: 'decizie', 
        nume_fisier: numeFisier, 
        cale_fisier: `uploads/${req.utilizator.id}/${numeFisier}`, 
        status_document: 'validat' 
      });
      
      await dosar.update({ status: 'aprobat' });
      
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: dosar.cetatean.email,
        subject: `[DGASPC] Certificat de Handicap Emis - Dosar ${dosar.numar_dosar}`,
        html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p>
               <p>Vă informăm cu bucurie că dosarul a fost <strong>APROBAT</strong> de comisie.</p>
               <p>Certificatul dumneavoastră a fost emis în format electronic. Îl puteți descărca direct din secțiunea "Documente atașate" a dosarului.</p>`
      }).catch(console.error);

      res.json({ mesaj: 'Certificat generat din șablon cu succes!' });
    }
  } catch (err) { 
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
      utilizator_id: req.utilizator.id, dosar_id: doc.dosar_id, actiune: 'Document aprobat', detalii: `Validat: ${doc.nume_fisier}`, adresa_ip: req.ip,
    }).catch(err => console.error("Eroare istoric:", err));

    res.json({ mesaj: 'Document validat cu succes' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

module.exports = router;