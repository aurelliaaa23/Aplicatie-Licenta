const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Utilizator, Rol } = require('../models');
const { verificaToken }   = require('../middleware/auth.middleware');

// ── Nodemailer ────────────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail', // Folosim serviciul Gmail direct
  auth: { 
    user: process.env.EMAIL_USER, // Adresa ta de Gmail (ex: adresa.ta@gmail.com)
    pass: process.env.EMAIL_PASS  // PAROLA DE APLICAȚIE (16 litere) de la Google
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// Generează cod OTP de 6 cifre
function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Salvează codul în baza de date (expiră în 10 minute)
async function salveazaOTP(utilizator) {
  const cod    = genOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  
  // Actualizăm folosind coloanele corecte: cod_otp și cod_otp_expiry
  await utilizator.update({ cod_otp: cod, cod_otp_expiry: expiry });
  return cod;
}

// Trimite OTP pe email
async function trimiteEmailOTP(email, prenume, cod, subiect) {
  try {
    await mailer.sendMail({
      from: `"DGASPC Digital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subiect,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#16244a;padding:20px 24px;border-radius:10px 10px 0 0">
            <h2 style="color:white;margin:0;font-size:18px">DGASPC Digital</h2>
          </div>
          <div style="background:white;border:1px solid #e2e8f0;padding:32px 24px;border-radius:0 0 10px 10px">
            <p style="font-size:15px;color:#0f172a">Bună ziua, <strong>${prenume}</strong>,</p>
            <p style="color:#475569;font-size:14px">Codul dvs. de verificare este:</p>
            <div style="text-align:center;margin:28px 0">
              <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#2563eb;
                font-family:monospace;background:#eff6ff;padding:16px 28px;border-radius:10px;
                border:2px solid #bfdbfe;display:inline-block">
                ${cod}
              </span>
            </div>
            <p style="font-size:13px;color:#64748b;text-align:center">
              ⏱ Codul este valabil <strong>10 minute</strong>. Nu îl împărtășiți nimănui.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error('Eroare email:', e.message);
    return false;
  }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { nume, prenume, email, parola, telefon, cnp, tipCont, departament, specialitate, judet, oras } = req.body;

    if (!nume || !prenume || !email || !parola)
      return res.status(400).json({ eroare: 'Câmpurile obligatorii lipsesc' });

    const exista = await Utilizator.findOne({ where: { email } });
    if (exista) return res.status(400).json({ eroare: 'Email deja înregistrat' });

    let numeRol = tipCont || 'cetățean';
    const rol = await Rol.findOne({ where: { nume: numeRol } });
    if (!rol) {
      return res.status(400).json({ eroare: `Rolul ${numeRol} nu există în baza de date.` });
    }

    const hash = await bcrypt.hash(parola, 12);

    // Creare cont cu datele specifice fiecărui rol
    const user = await Utilizator.create({
      nume, 
      prenume, 
      email, 
      parola_hash: hash,
      telefon, 
      cnp: numeRol === 'cetățean' ? cnp : null,
      judet,
      oras,
      departament: numeRol === 'funcționar' ? departament : null,
      specialitate: numeRol === 'medic' ? specialitate : null,
      rol_id: rol.id,
      email_verificat: false,
    });

    // Generăm și trimitem codul pe e-mail
    const cod = await salveazaOTP(user);
    const emailOk = await trimiteEmailOTP(email, prenume, cod, 'Verificare cont DGASPC Digital');

    res.status(201).json({
      mesaj: 'Cont creat. S-a trimis codul pe e-mail.',
      user_id: user.id,
      email_trimis: emailOk,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/auth/verifica-cont ─────────────────────────────────────────────
router.post('/verifica-cont', async (req, res) => {
  try {
    const { user_id, cod_email } = req.body; 
    
    const user = await Utilizator.findByPk(user_id);
    if (!user) return res.status(404).json({ eroare: 'Utilizator negăsit' });

    if (user.email_verificat)
      return res.status(400).json({ eroare: 'Contul este deja verificat' });

    if (!user.cod_otp || user.cod_otp !== String(cod_email))
      return res.status(401).json({ eroare: 'Codul de pe e-mail este incorect' });

    if (new Date() > new Date(user.cod_otp_expiry))
      return res.status(401).json({ eroare: 'Codul de e-mail a expirat.' });

    // Activăm contul
    await user.update({ email_verificat: true, cod_otp: null, cod_otp_expiry: null });

    res.json({ mesaj: 'Cont verificat și activat cu succes!' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/auth/retrimite-otp ─────────────────────────────────────────────
router.post('/retrimite-otp', async (req, res) => {
  try {
    const { user_id, email } = req.body;

    const user = email
      ? await Utilizator.findOne({ where: { email } })
      : await Utilizator.findByPk(user_id);

    if (!user) return res.status(404).json({ eroare: 'Utilizator negăsit' });

    const cod = await salveazaOTP(user);
    const emailOk = await trimiteEmailOTP(user.email, user.prenume, cod, 'Cod nou de verificare DGASPC');
    
    res.json({ mesaj: 'Cod nou trimis', email_trimis: emailOk });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, parola } = req.body;
    if (!email || !parola)
      return res.status(400).json({ eroare: 'Email și parolă obligatorii' });

    const user = await Utilizator.findOne({ where: { email }, include: [Rol] });
    if (!user || !user.activ)
      return res.status(401).json({ eroare: 'Credențiale incorecte sau cont inactiv' });

    const parolaOk = await bcrypt.compare(parola, user.parola_hash);
    if (!parolaOk)
      return res.status(401).json({ eroare: 'Credențiale incorecte' });

    if (!user.email_verificat)
      return res.status(403).json({
        eroare: 'Contul nu este verificat. Verificați email-ul.',
        user_id: user.id,
        neverificat: true,
      });

    const cod = await salveazaOTP(user);
    const emailOk = await trimiteEmailOTP(
      user.email, user.prenume, cod,
      'Cod de autentificare DGASPC Digital'
    );

    if (!emailOk)
      return res.status(500).json({ eroare: 'Nu s-a putut trimite codul. Verificați configurarea email.' });

    res.json({
      mesaj:   `Cod de verificare trimis pe ${maskEmail(user.email)}`,
      user_id: user.id,
      email_mascat: maskEmail(user.email),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ eroare: err.message });
  }
});

// ── POST /api/auth/verifica-otp-login ────────────────────────────────────────
router.post('/verifica-otp-login', async (req, res) => {
  try {
    const { user_id, cod } = req.body;
    const user = await Utilizator.findByPk(user_id, { include: [Rol] });
    if (!user) return res.status(404).json({ eroare: 'Sesiune expirată. Reîncercați.' });

    if (!user.cod_otp || user.cod_otp !== String(cod))
      return res.status(401).json({ eroare: 'Cod incorect' });

    if (new Date() > new Date(user.cod_otp_expiry))
      return res.status(401).json({ eroare: 'Codul a expirat. Reveniți la login.' });

    await user.update({ cod_otp: null, cod_otp_expiry: null });

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.Rol.nume, cnp: user.cnp },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Am adăugat specialitate, județ și oraș aici pentru când va fi nevoie
    res.json({
      token,
      utilizator: {
        id: user.id, nume: user.nume, prenume: user.prenume,
        email: user.email, rol: user.Rol.nume,
        telefon: user.telefon, departament: user.departament,
        specialitate: user.specialitate, judet: user.judet, oras: user.oras,
        cnp: user.cnp // adăugat CNP, util pentru afișarea în profil
      },
    });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── GET /api/auth/profil ──────────────────────────────────────────────────────
router.get('/profil', verificaToken, async (req, res) => {
  const u = req.utilizator;
  res.json({
    utilizator: {
      id: u.id, nume: u.nume, prenume: u.prenume,
      email: u.email, rol: u.Rol?.nume,
      telefon: u.telefon, cnp: u.cnp, 
      departament: u.departament, specialitate: u.specialitate,
      judet: u.judet, oras: u.oras
    },
  });
});

// ── PATCH /api/auth/profil ────────────────────────────────────────────────────
router.patch('/profil', verificaToken, async (req, res) => {
  try {
    const { prenume, nume, telefon, email, judet, oras } = req.body;
    await req.utilizator.update({ prenume, nume, telefon, email, judet, oras });
    res.json({ mesaj: 'Profil actualizat', utilizator: { prenume, nume, telefon, email, judet, oras } });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── PATCH /api/auth/schimba-parola ────────────────────────────────────────────
router.patch('/schimba-parola', verificaToken, async (req, res) => {
  try {
    const { parola_curenta, parola_noua } = req.body;
    const ok = await bcrypt.compare(parola_curenta, req.utilizator.parola_hash);
    if (!ok) return res.status(401).json({ eroare: 'Parola curentă este incorectă' });
    if (!parola_noua || parola_noua.length < 8)
      return res.status(400).json({ eroare: 'Parola nouă trebuie să aibă minim 8 caractere' });

    const hash = await bcrypt.hash(parola_noua, 12);
    await req.utilizator.update({ parola_hash: hash });
    res.json({ mesaj: 'Parola schimbată cu succes' });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ── Helper: maschează email-ul (ex: i**@gmail.com) ───────────────────────────
function maskEmail(email) {
  const [user, domain] = email.split('@');
  const masked = user[0] + '*'.repeat(Math.max(user.length - 2, 1)) + (user.length > 1 ? user.slice(-1) : '');
  return `${masked}@${domain}`;
}

// ── GET /api/auth/medici ──────────────────────────────────────────────────────
// Extrage toți medicii din baza de date pentru dropdown-urile de la DosarNou
router.get('/medici', verificaToken, async (req, res) => {
  try {
    const rolMedic = await Rol.findOne({ where: { nume: 'medic' } });
    if (!rolMedic) return res.json([]);
    
    const medici = await Utilizator.findAll({
      where: { rol_id: rolMedic.id },
      attributes: ['id', 'nume', 'prenume', 'specialitate', 'judet', 'oras']
    });
    
    res.json(medici);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;