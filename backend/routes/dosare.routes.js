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
    indemnizatie: 'Protecția Copilului',
    alte_servicii: 'Asistență Socială',
  };
  return map[tip] || 'Asistență Socială';
}

function getDepartamenteEligibile(tip) {
  if (tip === 'certificat_handicap' || tip === 'evaluare_adulti') {
    return ['Evaluare Adulți (SECPAH)', 'Evaluare Complexă', 'Adulți cu Handicap', 'evaluare adulti(secpah)', 'evaluare adulti', 'SECPAH'];
  }
  if (tip === 'adoptie') return ['Adopții'];
  if (tip === 'plasament' || tip === 'alocatie' || tip === 'indemnizatie') return ['Protecția Copilului', 'Asistență Socială'];
  
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
      { model: Utilizator, as: 'functionar' },
      { model: Document }
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
    if(tip === 'certificat_handicap'){
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
  }

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
        { model: ProgramareComisie },
        { model: SolicitareMedicala, as: 'solicitari' }
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

    // -------------------------------------------------------------------------
    // GENERARE AUTOMATĂ DECIZIE PENTRU COPII (ALOCAȚIE / INDEMNIZAȚIE)
    // -------------------------------------------------------------------------
    if (['alocatie', 'indemnizatie'].includes(dosar.tip) && ['aprobat', 'respins'].includes(status)) {
      try {
        // 1. Aducem cetățeanul asociat
        const cetatean = await Utilizator.findByPk(dosar.cetatean_id);
        
        // 2. Căutăm șablonul deciziei adăugat anterior
        const sablon = await SablonDocument.findOne({ where: { nume_sablon: 'Decizie_Beneficiu_Copil' } });
        
        if (sablon && cetatean) {
          let html = sablon.continut_html;
          
          // 3. Setăm textele și culorile dinamice în funcție de Aprobare sau Respingere
          const tipFormatat = dosar.tip === 'alocatie' ? 'Alocație de Stat pentru Copii' : 'Indemnizație Creștere Copil';
          const statusDecizie = status === 'aprobat' ? 'APROBAT' : 'RESPINS';
          
          // Preluăm motivul din request (dacă a fost respins)
          const motivDecizie = status === 'respins' 
                ? `Motiv respingere: ${req.body.motiv_respingere || 'Neîndeplinire condiții legale.'}` 
                : 'Dosarul îndeplinește toate condițiile legale pentru acordarea beneficiului.';
                
          const culoare = status === 'aprobat' ? '#16a34a' : '#dc2626'; // Verde pt aprobat, Roșu pt respins
          const bg = status === 'aprobat' ? '#f0fdf4' : '#fef2f2'; // Fundal verde deschis sau roșu deschis
          
          // 4. Înlocuim variabilele în HTML
          html = html.replace(/{{NUMAR_DOSAR}}/g, dosar.numar_dosar || dosar.id);
          html = html.replace(/{{NUME}}/g, cetatean.nume);
          html = html.replace(/{{PRENUME}}/g, cetatean.prenume);
          html = html.replace(/{{CNP}}/g, cetatean.cnp || '-');
          html = html.replace(/{{TIP_DOSAR_FORMATAT}}/g, tipFormatat);
          html = html.replace(/{{STATUS_DECIZIE}}/g, statusDecizie);
          html = html.replace(/{{MOTIV_DECIZIE}}/g, motivDecizie);
          html = html.replace(/{{CULOARE_DECIZIE}}/g, culoare);
          html = html.replace(/{{BG_DECIZIE}}/g, bg);
          html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));

          // 5. Pregătirea modulelor de scriere fișiere
          const fs = require('fs');
          const path = require('path');
          const html_to_pdf = require('html-pdf-node'); // sau librăria ta

          const uploadDir = path.join(__dirname, '..', 'uploads', String(dosar.id));
          if (!fs.existsSync(uploadDir)) { 
            fs.mkdirSync(uploadDir, { recursive: true }); 
          }

          // 6. Generarea efectivă a PDF-ului
          const fileName = `Decizie_Finala_${dosar.id}_${Date.now()}.pdf`;
          const filePath = path.join(uploadDir, fileName);
          
          const options = { format: 'A4', printBackground: true, margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' } };
          const pdfBuffer = await html_to_pdf.generatePdf({ content: html }, options);
          fs.writeFileSync(filePath, pdfBuffer);

          // 7. Salvarea documentului în tabelul Documente
          // Setăm tipul ca "decizie" (platforma ta deja îl recunoaște și îl afișează frumos, colorat)
          await Document.create({
            dosar_id: dosar.id,
            tip_document: 'decizie', 
            nume_fisier: 'Decizie Finală DGASPC',
            cale_fisier: `uploads/${dosar.id}/${fileName}`,
            validat: true
          });
        }
      } catch (error) {
        console.error('Eroare la generarea deciziei PDF automate:', error);
      }
    }
    // -------------------------------------------------------------------------

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

// ── POST /api/dosare/:id/notifica-reprezentant (NOU) ─────────────────────────
router.post('/:id/notifica-reprezentant', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { reprezentant_id } = req.body; 
    
    const dosar = await Dosar.findByPk(dosarId, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    const reprezentant = await Utilizator.findByPk(reprezentant_id);
    if (!reprezentant) return res.status(404).json({ eroare: 'Reprezentantul școlii nu a fost găsit.' });

    // Refolosim tabela SolicitareMedicala (sau echivalentul ei) ca sistem general de notificari
    await SolicitareMedicala.create({
      medic_id: reprezentant.id, 
      cetatean_id: dosar.cetatean.id, 
      dosar_id: dosarId, 
      status: 'in_asteptare', 
      observatii: 'Adeverință școlară'
    });

    await mailer.sendMail({
      from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
      to: reprezentant.email,
      subject: `[DGASPC] Solicitare Adeverință Școlară - ${dosar.cetatean.prenume} ${dosar.cetatean.nume}`,
      html: `<p>Stimate/ă ${reprezentant.nume},</p><p>Aveți o nouă solicitare pentru completarea adeverinței școlare pentru copilul ${dosar.cetatean.prenume} ${dosar.cetatean.nume}. Vă rugăm să accesați platforma.</p>`
    }).catch(console.error);

    res.json({ mesaj: 'Reprezentantul unității de învățământ a fost notificat cu succes!' });
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

// ── GET Solicitări pentru Reprezentant Școală ──
// ── GET Solicitări pentru Reprezentant Școală (Ruta REPARATĂ) ─────────────
router.get('/reprezentant/solicitari', verificaToken, async (req, res) => {
  try {
    const solicitari = await SolicitareMedicala.findAll({
      where: { medic_id: req.utilizator.id },
      include: [
        { model: Dosar, as: 'dosar', include: [{ model: Utilizator, as: 'cetatean' }] },
        { model: Utilizator, as: 'cetatean' }
      ]
    });
    res.json(solicitari);
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});
// ── POST Generare Cerere PDF Alocație / Indemnizație ──
router.post('/genereaza-cerere-copil', verificaToken, async (req, res) => {
  try {
    const { dosar_id, tip_dosar, date_cerere, date_familie, date_indemnizatie, semnatura_base64 } = req.body;
    
    // Aducem Dosarul și Cetățeanul
    const dosar = await Dosar.findByPk(dosar_id);
    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit' });
    const cetatean = await Utilizator.findByPk(dosar.cetatean_id);

    // Alegem șablonul pe baza tipului
    const numeSablon = tip_dosar === 'alocatie' ? 'Cerere_Alocatie_Stat' : 'Cerere_Indemnizatie';
    const sablon = await SablonDocument.findOne({ where: { nume_sablon: numeSablon } });
    if (!sablon) return res.status(404).json({ eroare: 'Șablonul nu există în baza de date' });

    let html = sablon.continut_html;

    // Înlocuim variabilele comune
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

    // Variabile specifice Alocației
    if (tip_dosar === 'alocatie') {
      html = html.replace(/{{SERIE_CI}}/g, date_cerere.serie_ci);
      html = html.replace(/{{NUMAR_CI}}/g, date_cerere.numar_ci);
    }

    // Variabile specifice Indemnizației
    if (tip_dosar === 'indemnizatie') {
      let numeSot = date_familie.tipFamilie === 'integrala' && date_familie.numeSot ? date_familie.numeSot : '-';
      let beneficiar = date_indemnizatie.beneficiar === 'titular' ? `${cetatean.nume} ${cetatean.prenume}` : numeSot;
      
      html = html.replace(/{{BENEFICIAR}}/g, beneficiar);
      html = html.replace(/{{NUME_SOT}}/g, numeSot);
    }

    // Generăm calea de salvare
    const fs = require('fs');
    const path = require('path');
    const html_to_pdf = require('html-pdf-node'); // sau modulul tău de pdf

    const uploadDir = path.join(__dirname, '..', 'uploads', String(dosar_id));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `Cerere_${tip_dosar === 'alocatie' ? 'Alocatie' : 'Indemnizatie'}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    const options = { format: 'A4', margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' } };
    const file = { content: html };

    // Creăm fișierul PDF
    const pdfBuffer = await html_to_pdf.generatePdf(file, options);
    fs.writeFileSync(filePath, pdfBuffer);

    // Salvăm în baza de date
    await Document.create({
      dosar_id: dosar_id,
      tip_document: 'alte', // folosim 'alte' pentru a nu afecta constrângerile ENUM vechi
      nume_fisier: tip_dosar === 'alocatie' ? 'Cerere Acordare Alocație Stat' : 'Cerere Acordare Indemnizație',
      cale_fisier: `uploads/${dosar_id}/${fileName}`,
      validat: true // Se consideră validat fiindcă e generat automat
    });

    res.json({ mesaj: 'Cerere PDF generată și atașată cu succes.' });
  } catch (err) {
    console.error("Eroare la generarea cererii PDF:", err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST Finalizare Formular Școală (Generare PDF) ──
// ── POST Finalizare Formular Școală (Generare PDF) ──
router.post('/:id/adeverinta-scolara', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const reprezentantId = req.utilizator.id; // PRELUAT CORECT DIN TOKEN
    const { clasa, media, nr_absente, semnatura_base64 } = req.body;
    
    // Aducem dosarul manual și apoi cetățeanul (metodă 100% sigură care nu depinde de asocieri complexe `include`)
    const dosar = await Dosar.findByPk(dosarId);
    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit.' });
    
    const cetatean = await Utilizator.findByPk(dosar.cetatean_id);
    
    const reprezentant = await Utilizator.findByPk(reprezentantId, { include: [{ model: ProfilFunctionar, as: 'profilFunctionar' }] });
    const sablon = await SablonDocument.findOne({ where: { nume_sablon: 'Adeverinta_Scolara' } });
    if (!sablon) return res.status(404).json({ eroare: 'Șablonul PDF nu a fost găsit.' });

    let html = sablon.continut_html;
    html = html.replace(/{{INSTITUTIE}}/g, reprezentant.profilFunctionar?.institutie || 'Unitate de Învățământ');
    html = html.replace(/{{NUME_PARINTE}}/g, cetatean.nume);
    html = html.replace(/{{PRENUME_PARINTE}}/g, cetatean.prenume);
    html = html.replace(/{{CNP_PARINTE}}/g, cetatean.cnp);
    html = html.replace(/{{CLASA}}/g, clasa || '-');
    html = html.replace(/{{MEDIA}}/g, media || '-');
    html = html.replace(/{{NR_ABSENTE}}/g, nr_absente || '0');
    html = html.replace(/{{DATA_CURENTA}}/g, new Date().toLocaleDateString('ro-RO'));
    html = html.replace(/{{TIP_REPREZENTANT}}/g, reprezentant.profilFunctionar?.departament || 'Cadru didactic');
    html = html.replace(/{{SEMNATURA_BASE64}}/g, semnatura_base64);

    const uploadDir = path.join(__dirname, '../uploads', String(cetatean.id));
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const fileName = `Adeverinta_Scolara_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    const pdfBuffer = await htmlToPdf.generatePdf({ content: html }, { format: 'A4', margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' } });
    fs.writeFileSync(filePath, pdfBuffer);

    await Document.create({
      dosar_id: dosarId, utilizator_id: reprezentantId, tip_document: 'adeverinta_scolara',
      nume_fisier: 'Adeverință Școlară', cale_fisier: `uploads/${cetatean.id}/${fileName}`, validat: true
    });

    await SolicitareMedicala.update({ status: 'finalizata' }, { where: { dosar_id: dosarId, medic_id: reprezentantId } });

    res.json({ mesaj: 'Adeverința a fost generată!' });
  } catch (err) { 
    console.error('Eroare Adeverinta PDF:', err);
    res.status(500).json({ eroare: err.message }); 
  }
});

module.exports = router;