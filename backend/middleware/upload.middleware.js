const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads', String(req.utilizator.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unic = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unic + path.extname(file.originalname));
  },
});

const filtruFisiere = (req, file, cb) => {
  const tipuriPermise = /pdf|jpg|jpeg|png/;
  const extOk = tipuriPermise.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = tipuriPermise.test(file.mimetype);
  if (extOk && mimeOk) cb(null, true);
  else cb(new Error('Doar fișiere PDF, JPG, PNG sunt acceptate'));
};

const upload = multer({
  storage,
  fileFilter: filtruFisiere,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;