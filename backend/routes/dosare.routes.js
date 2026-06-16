const router = require('express').Router();
const { Dosar, Utilizator, Document, Notificare, IstoricActiuni, SolicitareMedicala, ProgramareComisie, ProfilFunctionar } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const nodemailer = require('nodemailer');


// Mapare tip → departament
function mapTipLaDepartament(tip) {
  const map = {
    certificat_handicap: 'Evaluare Adulți (SECPAH)',
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
        { model: Utilizator, as: 'functionar', attributes: ['id', 'nume', 'prenume'], 
          include: [{ model: ProfilFunctionar, as: 'profilFunctionar', attributes: ['departament', 'institutie'] }] },
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
        { model: Utilizator, as: 'cetatean',   attributes: ['id', 'nume', 'prenume', 'email', 'telefon'] },
        { model: Utilizator, as: 'functionar', attributes: ['id', 'nume', 'prenume'], 
          include: [{ model: ProfilFunctionar, as: 'profilFunctionar', attributes: ['departament', 'institutie'] }] },
        { model: Document },
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

// ── POST /api/dosare (Alocare Automată Funcționar) ──────────────────────
router.post('/', verificaToken, verificaRol('cetățean'), async (req, res) => {
  try {
    const { tip, descriere, prioritate } = req.body;
    const numar = `DGASPC-${Date.now()}`;
    const deptDosar = mapTipLaDepartament(tip);

    // Căutare automată funcționar eligibil
    const { Rol: RolModel, Utilizator: UtilizatorModel, Dosar: DosarModel } = require('../models');
    const { Op } = require('sequelize');
    let functionarAlocatId = null;

    const rolFunc = await RolModel.findOne({ where: { nume: 'funcționar' } });
    if (rolFunc) {
      // Căutăm funcționarii din departamentul potrivit (Evaluare Complexă / Adulți cu Handicap)
      const functionariEligibili = await UtilizatorModel.findAll({
        where: {
          rol_id: rolFunc.id,
          activ: true,
          departament: {
            [Op.in]: ['Evaluare Complexă', 'Adulți cu Handicap', deptDosar]
          }
        }
      });

      // Îl alegem pe primul care are mai puțin de 5 dosare active în lucru
      for (const f of functionariEligibili) {
        const activeCount = await DosarModel.count({
          where: {
            functionar_id: f.id,
            status: { [Op.in]: ['depus', 'in_analiza', 'incomplet', 'programat_comisie'] }
          }
        });
        if (activeCount < 5) {
          functionarAlocatId = f.id;
          break;
        }
      }
    }

    const dosar = await Dosar.create({
      numar_dosar:  numar,
      tip,
      descriere,
      prioritate:   prioritate || 'normal',
      cetatean_id:  req.utilizator.id,
      functionar_id: functionarAlocatId, // ID-ul alocat automat
      departament:  deptDosar,
      status:       'depus',
    });

    await IstoricActiuni.create({
      utilizator_id: req.utilizator.id,
      dosar_id:      dosar.id,
      actiune:       'Dosar creat și alocat automat',
      detalii:       { tip, numar_dosar: numar, functionar_id: functionarAlocatId },
      adresa_ip:     req.ip,
    }).catch(() => {});

    res.status(201).json(dosar);
  } catch (err) {
    console.error('POST /dosare error:', err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── PATCH /api/dosare/:id/status (Actualizare Status + Trimitere Email-uri) ──
router.patch('/:id/status', verificaToken,
  verificaRol('funcționar', 'manager', 'administrator'),
  async (req, res) => {
    try {
      const dosar = await Dosar.findByPk(req.params.id, {
        include: [{ model: Utilizator, as: 'cetatean' }],
      });
      if (!dosar) return res.status(404).json({ eroare: 'Dosar negăsit' });

      const { status, motiv_respingere, documente_suplimentare } = req.body;
      await dosar.update({ status, motiv_respingere: motiv_respingere || null });

      // Configurare Mailer
      const mailer = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST,
        port:   Number(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      // 1. Email pentru "Cere documente suplimentare"
      if (status === 'incomplet' && documente_suplimentare) {
        const mailOptions = {
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: dosar.cetatean.email,
          subject: `[DGASPC] Acțiune necesară: Documente suplimentare dosar nr. ${dosar.numar_dosar}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e2f5c;">DGASPC Digital</h2>
              <p>Stimate/ă <strong>${dosar.cetatean.prenume} ${dosar.cetatean.nume}</strong>,</p>
              <p>În urma analizării dosarului dumneavoastră (Cod: <strong>${dosar.numar_dosar}</strong>), funcționarul a constatat că sunt necesare următoarele documente suplimentare:</p>
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; color: #b45309; font-weight: 500;">
                ${documente_suplimentare.replace(/\n/g, '<br>')}
              </div>
              <p>Vă rugăm să vă autentificați pe platformă pentru a retransmite sau completa fișierele solicitate.</p>
              <div style="text-align: center; margin-top: 25px;"><a href="http://localhost:3000/login" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Autentificare în Platformă</a></div>
            </div>
          `
        };
        await mailer.sendMail(mailOptions).catch(console.error);
      }

      // 2. Email pentru "Validare și Programare"
      if (status === 'astepetare_programare') {
        const mailOptions = {
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: dosar.cetatean.email,
          subject: `[DGASPC] Dosar Validat - Programare Comisie nr. ${dosar.numar_dosar}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e2f5c;">DGASPC Digital</h2>
              <p>Stimate/ă <strong>${dosar.cetatean.prenume} ${dosar.cetatean.nume}</strong>,</p>
              <p>Vă informăm că dosarul dumneavoastră nr. <strong>${dosar.numar_dosar}</strong> a fost verificat și <strong>VALIDAT</strong> cu succes.</p>
              <p><strong>Următorul pas:</strong> Aveți obligația de a intra pe platformă pentru a vă programa la comisie într-o <strong>zi disponibilă din următoarele 10 zile lucrătoare</strong>.</p>
              <div style="text-align: center; margin-top: 25px;"><a href="http://localhost:3000/login" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Alege data programării</a></div>
            </div>
          `
        };
        await mailer.sendMail(mailOptions).catch(console.error);
      }

      // Notificare în platformă
      await Notificare.create({
        utilizator_id: dosar.cetatean_id,
        titlu:         `Dosar ${dosar.numar_dosar} actualizat`,
        mesaj:         `Statusul dosarului tău a fost schimbat în: ${status}`
      }).catch(() => {});

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${dosar.cetatean_id}`).emit('dosar_actualizat', {
          dosar_id:     dosar.id,
          status,
          numar_dosar:  dosar.numar_dosar,
        });
      }

      await IstoricActiuni.create({
        utilizator_id: req.utilizator.id,
        dosar_id:      dosar.id,
        actiune:       `Status schimbat în: ${status}`,
        detalii:       { status_nou: status },
        adresa_ip:     req.ip,
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

// ── POST /api/dosare/:id/programeaza ──────────────────────────────────
// ── POST /api/dosare/:id/programeaza ──────────────────────────────────
router.post('/:id/programeaza', verificaToken, verificaRol('cetățean'), async (req, res) => {
  try {
    const { data_programare, ora } = req.body;
    const dosarId = req.params.id;

    // Extragem dosarul pentru a ști cui funcționar i-a fost alocat și ce tip este
    const dosar = await Dosar.findByPk(dosarId);
    if (!dosar) {
      return res.status(404).json({ eroare: 'Dosar negăsit' });
    }

    // Combinăm string-urile pentru a crea un obiect Date valid (ex. "2024-06-15T09:00:00")
    const data_ora = new Date(`${data_programare}T${ora}:00`);

    // Mapăm tipul dosarului la ENUM-ul "tip_comisie" cerut de modelul tău
    const mapTipComisie = (tip) => {
      if (tip === 'plasament') return 'protectia_copilului';
      if (tip === 'adoptie') return 'adoptii';
      if (tip === 'evaluare_adulti') return 'evaluare_adulti';
      return 'handicap'; // Fallback pentru restul (ex: certificat_handicap)
    };

    // Salvăm programarea exact cum o cere modelul ProgramareComisie.js
    await ProgramareComisie.create({
      dosar_id: dosar.id,
      funcționar_id: dosar.functionar_id, 
      tip_comisie: mapTipComisie(dosar.tip),
      data_ora: data_ora, // Câmpul tău este data_ora, nu data_comisie
      locatie: 'Sediul Central DGASPC',
      status: 'programat' // Ai in enum: 'programat', nu 'confirmat'
    });


    await dosar.update({ status: 'programat_comisie' });
    
    res.json({ mesaj: 'Programarea a fost înregistrată cu succes!' });
  } catch (err) {
    console.error('Eroare la programare:', err);
    res.status(500).json({ eroare: 'Nu s-a putut salva programarea. Motiv: ' + err.message });
  }
});

// ── PATCH /api/dosare/document/:docId/aprobare (Aprobare document individual) ──
router.patch('/document/:docId/aprobare', verificaToken, async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.docId);
    if (!doc) return res.status(404).json({ eroare: 'Document negăsit' });
    await doc.update({ validat: true }); // setăm validat pe true
    res.json({ mesaj: 'Document validat' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/dosare/:id/finalizare-comisie (Generare Certificat sau Respingere) ──
router.post('/:id/finalizare-comisie', verificaToken, async (req, res) => {
  try {
    const dosar = await Dosar.findByPk(req.params.id, {
      include: [{ model: Utilizator, as: 'cetatean' }]
    });
    const { actiune, grad, revizuire_luni, motiv } = req.body;

    const mailer = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    if (actiune === 'respinge') {
      await dosar.update({ status: 'respins', motiv_respingere: motiv });
      await mailer.sendMail({
        from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
        to: dosar.cetatean.email,
        subject: `[DGASPC] Decizie Comisie - Dosar Respins nr. ${dosar.numar_dosar}`,
        html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p><p>Dosarul dumneavoastră a fost evaluat de comisie și a fost <strong>RESPINS</strong>.</p><p><strong>Motivul respingerii:</strong><br/>${motiv}</p>`
      }).catch(console.error);
      return res.json({ mesaj: 'Dosar respins!' });
    }

    if (actiune === 'aproba') {
      const dir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      const fileName = `Certificat_Handicap_${Date.now()}.pdf`;
      const filePath = path.join(dir, fileName);
      const stream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(stream);

      // Generare PDF
      doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICAT', { align: 'center' });
      doc.fontSize(14).text('de incadrare in grad de handicap', { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(12).font('Helvetica').text('Comisia de evaluare persoane adulte cu handicap, constituita in temeiul Legii nr.448/2006, privind protectia si promovarea drepturilor persoanelor cu handicap, republicata, cu modificarile si completarile ulterioare, evaluand dosarul si propunerea serviciului de evaluare complexa a persoanelor adulte cu handicap:', { align: 'justify' });
      doc.moveDown();
      
      doc.font('Helvetica-Bold').text(`Privind pe domnul/doamna: ${dosar.cetatean.prenume} ${dosar.cetatean.nume}`);
      doc.text(`C.N.P.: ${dosar.cetatean.cnp || '..........................'}`);
      doc.text(`Domiciliul: Județ/Oraș ${dosar.cetatean.judet || ''} ${dosar.cetatean.oras || ''}`);
      doc.moveDown();

      doc.font('Helvetica').text('Stabileste urmatoarele:');
      doc.moveDown();
      doc.font('Helvetica-Bold').text(`1. Se incadreaza in gradul de handicap: ${grad.toUpperCase()}`);
      
      let valabilitateText = "Permanent (Nelimitat)";
      let dataRevizuire = "Nu este cazul";
      
      if (revizuire_luni !== 'nelimitat') {
        const data = new Date();
        data.setMonth(data.getMonth() + parseInt(revizuire_luni));
        valabilitateText = `${revizuire_luni} luni`;
        dataRevizuire = data.toLocaleDateString('ro-RO');
      }

      doc.text(`2. Valabilitate: ${valabilitateText}`);
      doc.text(`3. Termen de revizuire: ${dataRevizuire}`);
      doc.moveDown(3);
      doc.text('Presedinte Comisie,', { align: 'right' });
      doc.end();

      stream.on('finish', async () => {
        await Document.create({
          dosar_id: dosar.id, utilizator_id: req.utilizator.id, tip_document: 'decizie',
          nume_fisier: 'Certificat_Incadrare_Handicap.pdf', cale_fisier: `uploads/${fileName}`, validat: true
        });
        await dosar.update({ status: 'aprobat' });

        await mailer.sendMail({
          from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
          to: dosar.cetatean.email,
          subject: `[DGASPC] Certificat de Handicap Emis - Dosar ${dosar.numar_dosar}`,
          html: `<p>Stimate/ă ${dosar.cetatean.prenume} ${dosar.cetatean.nume},</p><p>Dosarul a fost <strong>APROBAT</strong> de comisie și a fost emis certificatul de încadrare în grad de handicap. Îl puteți descărca din secțiunea de documente a dosarului dumneavoastră pe platformă.</p>`
        }).catch(console.error);

        res.json({ mesaj: 'Certificat generat și dosar aprobat!' });
      });
    }
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;