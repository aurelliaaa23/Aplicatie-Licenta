const express = require('express');
const router = express.Router();
const { Dosar, Utilizator, Rol, Document, IstoricActiuni, ProgramareComisie, ProfilFunctionar, SolicitareMedicala, SablonDocument, Notificare } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const htmlToPdf = require('html-pdf-node');
const nodemailer = require('nodemailer');
const { ProfilCetatean } = require('../models');

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
      include: [
        { model: Dosar, as: 'dosar', include: [{ model: Utilizator, as: 'cetatean' , include: [{ model: ProfilCetatean, as: 'profilCetatean' }] }] },
        { model: Utilizator, as: 'cetatean', include: [{ model: ProfilCetatean, as: 'profilCetatean' }] }
      ]
    });
    res.json(solicitari);
  } catch (err) { res.status(500).json({ eroare: err.message }); }
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
      { model: Utilizator, as: 'cetatean', include: [{ model: ProfilCetatean, as: 'profilCetatean' }] },
        { model: Utilizator, as: 'functionar' },
        { model: Document },
        { model: ProgramareComisie },
        { model: SolicitareMedicala, as: 'solicitari' }
    ];

    

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

    // Dacă a fost găsit un funcționar eligibil, dosarul intră direct "În analiză".
    // Dacă nu (nu există funcționar disponibil în departament/județ), rămâne "Depus" până la alocare manuală.
    const statusInitial = functionarAlocatId ? 'in_analiza' : 'depus';

    const dosar = await Dosar.create({
      numar_dosar:  numar,
      tip, descriere, prioritate: prioritate || 'normal',
      cetatean_id:  req.utilizator.id,
      functionar_id: functionarAlocatId,
      departament:  deptDosar,
      status:       statusInitial,
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id, dosar_id: dosar.id,
      actiune: functionarAlocatId ? 'Dosar creat și alocat automat funcționarului' : 'Dosar creat, în așteptare alocare funcționar',
      detalii: `Tip: ${tip}, Dosar: ${numar}, Funcționar: ${functionarAlocatId ? 'Alocat' : 'Nealocat'}, Status: ${statusInitial}`,
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
          },
          include: [{ model: ProfilFunctionar, as: 'profilFunctionar' }]
        });
        for (const primarie of primarii) {
          const dept = (primarie.profilFunctionar?.departament || '').toLowerCase();
          const esteEvidenta = dept.includes('evidenț') || dept.includes('evident') || dept.includes('persoane');
          if (esteEvidenta) continue; // Evidența Persoanelor nu are nicio sarcină la dosarele de handicap

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
  // (În interiorul router.post('/', ...), după creare dosar și istoric)
    
    if (tip === 'adoptie') {
      try {
        const rolPrimarie = await Rol.findOne({ where: { nume: 'funcționar_primărie' } });
        const rolPolitie = await Rol.findOne({ where: { nume: 'funcționar_poliție' } });

        // Notificăm și Asignăm Primăriei
        // Notificăm și Asignăm Primăriei — text diferit pentru fiecare departament
        if (rolPrimarie && cetatean.judet && cetatean.oras) {
          const primarii = await Utilizator.findAll({
            where: { rol_id: rolPrimarie.id, activ: true, judet: cetatean.judet, oras: { [Op.substring]: cetatean.oras } },
            include: [{ model: ProfilFunctionar, as: 'profilFunctionar' }]
          });
          for (const primarie of primarii) {
            const dept = (primarie.profilFunctionar?.departament || '').toLowerCase();
            const esteEvidenta = dept.includes('evidenț') || dept.includes('evident') || dept.includes('persoane');

            const subiect = esteEvidenta
              ? `[DGASPC] Solicitare Atestare Domiciliu - Dosar ${numar}`
              : `[DGASPC] Solicitare Anchetă Socială - Dosar ${numar}`;
            const mesajSpecific = esteEvidenta
              ? 'Vă rugăm să confirmați domiciliul solicitantului și să emiteți adeverința de domiciliu.'
              : 'Vă rugăm să efectuați Ancheta Socială aferentă acestui dosar.';

            await mailer.sendMail({
              from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`, to: primarie.email,
              subject: subiect,
              html: `<p>A fost declanșată procedura de adopție (Dosar <strong>${numar}</strong>) în localitatea dvs. ${mesajSpecific}</p>`
            }).catch(console.error);
          }
        }
        
        // Notificăm Poliția Județeană (se bazează doar pe județ)
        if (rolPolitie && cetatean.judet) {
          const politisti = await Utilizator.findAll({ where: { rol_id: rolPolitie.id, activ: true, judet: cetatean.judet } });
          for (const politist of politisti) {
            await mailer.sendMail({
              from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`, to: politist.email,
              subject: `[DGASPC] Solicitare Cazier - Adopție Dosar ${numar}`,
              html: `<p>Vă rugăm să eliberați Cazierul Judiciar pentru Dosarul de Adopție <strong>${numar}</strong>.</p>`
            }).catch(console.error);
          }
        }
      } catch(errMail) { console.error(errMail); }
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
        { model: Utilizator, as: 'cetatean',include: [{ model: ProfilCetatean, as: 'profilCetatean' }]}, 
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
// ── PATCH /api/dosare/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', verificaToken, async (req, res) => {
  try {
    const { status, motiv_respingere, documente_suplimentare, semnatura_functionar_base64 } = req.body;

    const dosar = await Dosar.findByPk(req.params.id, {
      include: [{ model: Utilizator, as: 'cetatean', include: [{ model: ProfilCetatean, as: 'profilCetatean' }] }]
    });
    if (!dosar) return res.status(404).json({ eroare: 'Dosarul nu a fost găsit' });

    // Actualizăm statusul
    const updateData = { status };
    if (motiv_respingere !== undefined) updateData.motiv_respingere = motiv_respingere;
    await dosar.update(updateData);

    // ── Generare automată Hotărâre pentru Alocație / Indemnizație, la aprobare directă ──
    if (status === 'aprobat' && ['alocatie', 'indemnizatie'].includes(dosar.tip)) {
      try {
        const cetatean = dosar.cetatean;

        let numeCopil = '-', cnpCopil = '-';
        if (dosar.descriere && dosar.descriere.includes('[Date Copil:')) {
          const m = dosar.descriere.match(/\[Date Copil: (.*?), CNP: (.*?)\]/);
          if (m) { numeCopil = m[1]; cnpCopil = m[2]; }
        }

        let blocPartener = ' ';
        if (dosar.descriere && dosar.descriere.includes('[Partener:')) {
          const mp = dosar.descriere.match(/\[Partener: (.*?), CNP: (.*?)\]/);
          if (mp) blocPartener = ` împreună cu soțul/soția, <strong>${mp[1]}</strong> (CNP: ${mp[2]}),`;
        }

        const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const numeFisierHot = `Hotarare_${dosar.tip}_${dosar.id}_${Date.now()}.pdf`;
        const caleAbsolutaHot = path.join(dir, numeFisierHot);

        const payloadHotarare = {
          nume: cetatean.nume,
          prenume: cetatean.prenume,
          cnp: cetatean.cnp || '-',
          adresa_completa: cetatean.profilCetatean?.adresa_completa
            ? `${cetatean.profilCetatean.adresa_completa}, ${cetatean.oras || ''}, jud. ${cetatean.judet || ''}`
            : `${cetatean.oras || '-'}, jud. ${cetatean.judet || '-'}`,
          telefon: cetatean.telefon || '-',
          email: cetatean.email || '-',
          bloc_partener: blocPartener,
          nume_copil: numeCopil,
          cnp_copil: cnpCopil,
          numar_dosar: dosar.numar_dosar,
          durata_beneficiu: dosar.tip === 'alocatie'
            ? 'până la ieșirea copilului din sistemul de învățământ preuniversitar'
            : 'până la împlinirea de către copil a vârstei de 2 ani',
          nume_functionar: `${req.utilizator.prenume} ${req.utilizator.nume}`,
           semnatura_functionar_base64: semnatura_functionar_base64 || ''
        };

        await genereazaDinSablon('Decizie_Beneficiu_Copil', payloadHotarare, caleAbsolutaHot);

        await Document.create({
          dosar_id: dosar.id,
          tip_document: 'decizie',
          nume_fisier: numeFisierHot,
          cale_fisier: `uploads/${req.utilizator.id}/${numeFisierHot}`,
          status_document: 'validat',
          validat: true,
        });
      } catch (errHot) {
        console.error('Eroare generare hotărâre alocație/indemnizație:', errHot);
      }
    }
    // Salvăm în istoric
    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar.id,
      actiune:       `Status schimbat în: ${status}`,
      detalii:       documente_suplimentare || motiv_respingere || '',
      adresa_ip:     req.ip,
    }).catch(e => console.error('Eroare istoric:', e));

    // Trimitere notificare în platformă cetățeanului
    if (dosar.cetatean_id) {
      let titluNotif = 'Actualizare dosar';
      let mesajNotif = `Dosarul ${dosar.numar_dosar} a fost actualizat. Status nou: ${status}.`;

      if (status === 'incomplet' && documente_suplimentare) {
        titluNotif = '⚠️ Documente necesare';
        mesajNotif = `Dosarul ${dosar.numar_dosar} necesită documente suplimentare: ${documente_suplimentare}`;
      } else if (status === 'aprobat') {
        titluNotif = '✅ Dosar aprobat';
        mesajNotif = `Felicitări! Dosarul ${dosar.numar_dosar} a fost aprobat.`;
      } else if (status === 'respins') {
        titluNotif = '❌ Dosar respins';
        mesajNotif = `Dosarul ${dosar.numar_dosar} a fost respins. Motiv: ${motiv_respingere || 'Nespecificat'}`;
      }

      await Notificare.create({
        utilizator_id: dosar.cetatean_id,
        titlu:         titluNotif,
        mesaj:         mesajNotif,
        citita:        false,
      }).catch(e => console.error('Eroare notificare:', e));

      // Emit socket
      const io = req.app.get('io');
      if (io) io.to(`user_${dosar.cetatean_id}`).emit('notificare_noua', { titlu: titluNotif, mesaj: mesajNotif });
    }

    // ── Trimitere EMAIL când se cer documente suplimentare ──
    if (status === 'incomplet' && documente_suplimentare && dosar.cetatean?.email) {
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to:   dosar.cetatean.email,
        subject: `[DGASPC] Documente necesare - Dosar ${dosar.numar_dosar}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#16244a;padding:20px 24px;border-radius:10px 10px 0 0">
              <h2 style="color:white;margin:0;font-size:18px">DGASPC Digital</h2>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;padding:32px 24px;border-radius:0 0 10px 10px">
              <p style="font-size:15px;color:#0f172a">
                Bună ziua, <strong>${dosar.cetatean.prenume} ${dosar.cetatean.nume}</strong>,
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.6">
                Dosarul dumneavoastră cu numărul <strong>${dosar.numar_dosar}</strong> necesită documente suplimentare sau corectarea unor documente existente.
              </p>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0 0 8px 0;font-weight:600;color:#92400e">📋 Documente necesare:</p>
                <p style="margin:0;color:#78350f;white-space:pre-line;font-size:14px">${documente_suplimentare}</p>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.6">
                Vă rugăm să accesați platforma DGASPC Digital și să încărcați documentele solicitate în dosarul dvs.
              </p>
              <div style="text-align:center;margin:24px 0">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dosar/${dosar.id}" 
                   style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                  Accesați dosarul →
                </a>
              </div>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">
                O zi excelentă,<br>Echipa DGASPC
              </p>
            </div>
          </div>
        `,
      }).catch(err => console.error('Eroare email documente suplimentare:', err));
    }

    // ── Email la respingere ──
    if (status === 'respins' && dosar.cetatean?.email) {
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to:   dosar.cetatean.email,
        subject: `[DGASPC] Dosar respins - ${dosar.numar_dosar}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#16244a;padding:20px 24px;border-radius:10px 10px 0 0">
              <h2 style="color:white;margin:0;font-size:18px">DGASPC Digital</h2>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;padding:32px 24px;border-radius:0 0 10px 10px">
              <p style="font-size:15px;color:#0f172a">
                Bună ziua, <strong>${dosar.cetatean.prenume} ${dosar.cetatean.nume}</strong>,
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.6">
                Dosarul dumneavoastră cu numărul <strong>${dosar.numar_dosar}</strong> a fost respins.
              </p>
              ${motiv_respingere ? `
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0 0 8px 0;font-weight:600;color:#991b1b">Motiv:</p>
                <p style="margin:0;color:#7f1d1d;font-size:14px">${motiv_respingere}</p>
              </div>` : ''}
              <p style="color:#475569;font-size:14px">Pentru mai multe informații, vă rugăm să contactați DGASPC.</p>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">
                O zi excelentă,<br>Echipa DGASPC
              </p>
            </div>
          </div>
        `,
      }).catch(err => console.error('Eroare email respingere:', err));
    }

    res.json({ mesaj: 'Status actualizat cu succes' });
  } catch (err) {
    console.error('Eroare actualizare status dosar:', err);
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

        const numePacient = m.nume_pacient || `${dosar.cetatean.prenume} ${dosar.cetatean.nume}`;

        await SolicitareMedicala.create({
          medic_id: medicCurent.id, cetatean_id: dosar.cetatean.id, dosar_id: dosarId, 
          status: 'in_asteptare', observatii: m.tip
        });

        await mailer.sendMail({
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: medicCurent.email,
          subject: `[DGASPC] Solicitare Medicală - ${numePacient}`,
          html: `<p>Stimate/ă Dr. ${medicCurent.nume},</p><p>Aveți o nouă solicitare medicală pentru pacientul <strong>${numePacient}</strong>. Vă rugăm să accesați platforma pentru a completa documentele necesare.</p>`
        }).catch(console.error);
      } catch (errInner) { console.error("Eroare procesare medic:", errInner); }
    }
    res.json({ mesaj: 'Medicii au fost notificați cu succes!' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }

});

// ── GET /api/dosare/politie/solicitari — 1-2 „caziere" per dosar de adopție ──
router.get('/politie/solicitari', verificaToken, async (req, res) => {
  try {
    const politist = await Utilizator.findByPk(req.utilizator.id);
    if (!politist.judet) return res.json([]);

    const dosare = await Dosar.findAll({
      where: { tip: 'adoptie' },
      include: [
        { model: Utilizator, as: 'cetatean', where: { judet: politist.judet } },
        { model: Document }
      ],
      order: [['creat_la', 'DESC']]
    });

    const rezultat = [];
    for (const d of dosare) {
      const docs = d.Documents || [];
      let partener = null;
      if (d.descriere && d.descriere.includes('[Partener:')) {
        const match = d.descriere.match(/\[Partener: (.*?), CNP: (.*?)\]/);
        if (match) partener = { nume: match[1], cnp: match[2] };
      }

      const areCazierTitular = docs.some(doc => doc.nume_fisier?.includes('Cazier') && doc.nume_fisier?.includes('Titular'));
      rezultat.push({
        id: `${d.id}-titular`, dosar_id: d.id, dosar: d, cetatean: d.cetatean,
        observatii: 'Cazier judiciar (Titular)',
        status: areCazierTitular ? 'finalizata' : 'in_asteptare',
        creat_la: d.creat_la,
      });

      if (partener) {
        const areCazierSot = docs.some(doc => doc.nume_fisier?.includes('Cazier') && doc.nume_fisier?.includes('Sot'));
        rezultat.push({
          id: `${d.id}-sot`, dosar_id: d.id, dosar: d,
          observatii: 'Cazier judiciar (Soț/Soție)',
          numePartener: partener.nume,
          status: areCazierSot ? 'finalizata' : 'in_asteptare',
          creat_la: d.creat_la,
        });
      }
    }
    res.json(rezultat);
  } catch (err) {
    console.error('Eroare solicitari politie:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/dosare/:id/notifica-reprezentant (NOU) ─────────────────────────
router.post('/:id/notifica-reprezentant', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { reprezentant_id, date_copil } = req.body; 
    const dosar = await Dosar.findByPk(dosarId, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    const reprezentant = await Utilizator.findByPk(reprezentant_id);
    if (!reprezentant) return res.status(404).json({ eroare: 'Reprezentant negăsit.' });

    await SolicitareMedicala.create({ 
      medic_id: reprezentant.id, 
      cetatean_id: dosar.cetatean.id, 
      dosar_id: dosarId, 
      status: 'in_asteptare', 
      observatii: `Adeverință școlară pt: ${date_copil.nume} ${date_copil.prenume} (CNP: ${date_copil.cnp})`
    });

    await mailer.sendMail({
      from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`, to: reprezentant.email,
      subject: `[DGASPC] Solicitare Adeverință - Elev: ${date_copil.nume} ${date_copil.prenume}`,
      html: `<p>Aveți o solicitare pe platformă pentru a completa adeverința școlară pentru elevul ${date_copil.nume} ${date_copil.prenume}.</p>`
    }).catch(console.error);

    res.json({ mesaj: 'Reprezentantul a fost notificat!' });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

// ── POST /api/dosare/:id/scrisoare-medicala (HTML TEMPLATE) ────────────────
router.post('/:id/scrisoare-medicala', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    const { tip_scrisoare, ...payloadFront } = req.body;
    // Numele șablonului depinde de selecția medicului din front
    const nume_sablon = tip_scrisoare === 'specialist' ? 'Referat_Medic_Specialist' : 'Scrisoare_Medic_Familie';
    payloadFront.nume_intocmitor = `${req.utilizator.prenume} ${req.utilizator.nume}`;

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
      nume_fisier: fileName, cale_fisier: `uploads/${req.utilizator.id}/${fileName}`, status_document: 'incarcat' 
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

    const dosar = await Dosar.findByPk(dosarId);
    const nume_sablon = dosar?.tip === 'adoptie' ? 'Ancheta_Sociala_Adoptie' : 'Ancheta_Sociala';

    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${nume_sablon}_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);

    await genereazaDinSablon(nume_sablon, payloadFront, filePath);

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
    const { actiune, grad, revizuire_luni, motiv, nume_copil_adoptat, prenume_copil_adoptat, cnp_copil_adoptat, semnatura_functionar_base64 } = req.body;
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

      // ── ADOPȚIE — Certificat de Adopție cu datele copilului ──
      if (dosar.tip === 'adoptie') {
        if (!nume_copil_adoptat || !prenume_copil_adoptat || !cnp_copil_adoptat) {
          return res.status(400).json({ eroare: 'Numele, prenumele și CNP-ul copilului adoptat sunt obligatorii.' });
        }

        const numeFisier = `Certificat_Adoptie_${Date.now()}.pdf`;
        const caleAbsoluta = path.join(dir, numeFisier);

        let blocPartenerCertificat = '';
        if (dosar.descriere && dosar.descriere.includes('[Partener:')) {
          const mp = dosar.descriere.match(/\[Partener: (.*?), CNP: (.*?)\]/);
          if (mp) blocPartenerCertificat = `, împreună cu <strong>${mp[1]}</strong> (CNP: ${mp[2]})`;
        }

        const payloadSablon = {
          nume: dosar.cetatean.nume,
          prenume: dosar.cetatean.prenume,
          cnp: dosar.cetatean.cnp || '-',
          numar_dosar: dosar.numar_dosar,
          bloc_partener_certificat: blocPartenerCertificat,
          nume_copil_adoptat,
          prenume_copil_adoptat,
          cnp_copil_adoptat,
          nume_functionar: `${req.utilizator.prenume} ${req.utilizator.nume}`,
          semnatura_functionar_base64: semnatura_functionar_base64 || '',
        };

        await genereazaDinSablon('Decizie_Adoptie', payloadSablon, caleAbsoluta);

        await Document.create({
          dosar_id: dosar.id,
          tip_document: 'decizie',
          nume_fisier: numeFisier,
          cale_fisier: `uploads/${req.utilizator.id}/${numeFisier}`,
          status_document: 'validat',
          validat: true
        });

        await dosar.update({ status: 'aprobat' });

        await mailer.sendMail({
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: dosar.cetatean.email,
          subject: `[DGASPC] Certificat de Adopție Emis - Dosar ${dosar.numar_dosar}`,
          html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p>
                 <p>Vă informăm cu bucurie că adopția copilului <strong>${prenume_copil_adoptat} ${nume_copil_adoptat}</strong> a fost <strong>APROBATĂ</strong> de comisie.</p>
                 <p>Certificatul de adopție a fost emis în format electronic. Îl puteți descărca din secțiunea "Documente atașate" a dosarului.</p>`
        }).catch(console.error);

        return res.json({ mesaj: 'Certificat de adopție generat cu succes!' });
      }

      // ── HANDICAP — rămâne neschimbat ──
      const numeFisier = `Certificat_Handicap_${Date.now()}.pdf`; 
      const caleAbsoluta = path.join(dir, numeFisier);
      
      let valabilitateText = "Permanent (Nelimitat)"; 
      let dataRevizuire = "Nu este cazul";
      
      if (revizuire_luni && revizuire_luni !== 'nelimitat') {
        const data = new Date(); data.setMonth(data.getMonth() + parseInt(revizuire_luni));
        valabilitateText = `${revizuire_luni} luni`; 
        dataRevizuire = data.toLocaleDateString('ro-RO');
      }

      const payloadSablon = {
        nume: dosar.cetatean.nume,
        prenume: dosar.cetatean.prenume,
        cnp: dosar.cetatean.cnp || '-',
        judet: dosar.cetatean.judet || '-',
        oras: dosar.cetatean.oras || '-',
        grad: grad ? grad.toUpperCase() : 'NESPECIFICAT',
        valabilitate: valabilitateText,
        revizuire: dataRevizuire,
        nume_functionar: `${req.utilizator.prenume} ${req.utilizator.nume}`,
        semnatura_functionar_base64: semnatura_functionar_base64 || '',
      };

      await genereazaDinSablon('Certificat_Incadrare_Handicap', payloadSablon, caleAbsoluta);

      await Document.create({ 
        dosar_id: dosar.id, 
        tip_document: 'decizie', 
        nume_fisier: numeFisier, 
        cale_fisier: `uploads/${req.utilizator.id}/${numeFisier}`, 
        status_document: 'validat',
        validat: true
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

      return res.json({ mesaj: 'Certificat generat din șablon cu succes!' });
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
    const reprezentantId = req.utilizator.id; 
    const { nume_copil, prenume_copil, cnp_copil, clasa, media, nr_absente, semnatura_base64 } = req.body;
    req.body.nume_intocmitor = `${req.utilizator.prenume} ${req.utilizator.nume}`;
    
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
    
    html = html.replace(/{{NUME_COPIL}}/g, nume_copil || '-');
    html = html.replace(/{{PRENUME_COPIL}}/g, prenume_copil || '-');
    html = html.replace(/{{CNP_COPIL}}/g, cnp_copil || '-');

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
      nume_fisier: 'Adeverință Școlară', cale_fisier: `uploads/${cetatean.id}/${fileName}`,
      status_document: 'incarcat', validat: false
    });

    await SolicitareMedicala.update({ status: 'finalizata' }, { where: { dosar_id: dosarId, medic_id: reprezentantId } });

    res.json({ mesaj: 'Adeverința a fost generată!' });
  } catch (err) { 
    console.error('Eroare Adeverinta PDF:', err);
    res.status(500).json({ eroare: err.message }); 
  }
});

// ── POST /api/dosare/:id/document-adoptie (Poliție, Primărie, Medic) ─────────
// ── POST /api/dosare/:id/document-adoptie ──────────────────────────────────
router.post('/:id/document-adoptie', verificaToken, async (req, res) => {
  try {
    const dosarId = req.params.id;
    // Preluăm și solicitare_id din frontend
    const { tip_formular, date_formular, semnatura_base64, solicitare_id } = req.body; 
    
    const dosar = await Dosar.findByPk(dosarId, { include: [{ model: Utilizator, as: 'cetatean' }] });
    if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

    let nume_sablon = '';
    let titluFisier = '';
    let tipDocSalvat = 'alte';

    if (tip_formular === 'cazier') {
      const esteSot = date_formular?.PERSOANA_LABEL === 'Soț/Soție';
      nume_sablon = 'Cazier_Judiciar_Adoptie';
      titluFisier = esteSot ? 'Cazier Judiciar (Sot-Sotie)' : 'Cazier Judiciar (Titular)';
    } else if (tip_formular === 'domiciliu') {
      nume_sablon = 'Adeverinta_Domiciliu'; titluFisier = 'Adeverință Domiciliu';
    } else if (tip_formular === 'ancheta_adoptie') {
      nume_sablon = 'Ancheta_Sociala_Adoptie'; titluFisier = 'Anchetă Socială Adopție'; tipDocSalvat = 'ancheta_sociala';
    } else if (tip_formular === 'medical_adoptie') {
      nume_sablon = 'Adeverinta_Medicala_Adoptie'; titluFisier = `Certificat Medical (${date_formular.NUME_PACIENT})`; tipDocSalvat = 'certificat_medical';
    }

    const payload = {
      NUMAR_DOSAR: dosar.numar_dosar,
      NUME: dosar.cetatean.nume,
      PRENUME: dosar.cetatean.prenume,
      CNP: dosar.cetatean.cnp || '-',
      NUME_INTOCMITOR: `${req.utilizator.prenume} ${req.utilizator.nume}`,
      ...date_formular, 
      SEMNATURA_BASE64: semnatura_base64
    };

    const dir = path.join(__dirname, '../uploads', String(dosar.cetatean.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${nume_sablon}_${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);

    await genereazaDinSablon(nume_sablon, payload, filePath);

    await Document.create({
      dosar_id: dosarId, utilizator_id: req.utilizator.id, tip_document: tipDocSalvat,
      nume_fisier: titluFisier, cale_fisier: `uploads/${dosar.cetatean.id}/${fileName}`,
      status_document: 'incarcat', validat: false 
    });

    // ACTUALIZĂM STATUSUL SOLICITĂRII MEDICALE CA SĂ SE ASCUNDĂ FORMULARUL
    if (solicitare_id) {
      await SolicitareMedicala.update({ status: 'finalizata' }, { where: { id: solicitare_id } });
    }

    res.json({ mesaj: `${titluFisier} a fost generat și atașat cu succes!` });
  } catch (err) { res.status(500).json({ eroare: err.message }); }
});

// ── PATCH /api/dosare/document/:docId/aprobare ── (comună pentru toate tipurile)
router.patch('/document/:docId/aprobare', verificaToken, async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.docId);
    if (!doc) return res.status(404).json({ eroare: 'Documentul nu a fost găsit' });

    await doc.update({ validat: true, status_document: 'validat' });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      doc.dosar_id,
      actiune:       'Document aprobat',
      detalii:       `Document validat: ${doc.nume_fisier || doc.tip_document}`,
      adresa_ip:     req.ip,
    }).catch(e => console.error('Eroare istoric:', e));

    res.json({ mesaj: 'Document aprobat cu succes', id: doc.id });
  } catch (err) {
    console.error('Eroare aprobare document:', err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;