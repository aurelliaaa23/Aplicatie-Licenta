const jwt = require('jsonwebtoken');
const { Utilizator, Rol } = require('../models');

// Verifică token JWT valid
const verificaToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ eroare: 'Token lipsă sau invalid' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const utilizator = await Utilizator.findByPk(decoded.id, {
      include: [{ model: Rol }],
    });
    if (!utilizator || !utilizator.activ)
      return res.status(401).json({ eroare: 'Cont inactiv sau inexistent' });
    req.utilizator = utilizator;
    next();
  } catch (err) {
    return res.status(401).json({ eroare: 'Token expirat sau invalid' });
  }
};

// Verifică rolul utilizatorului
const verificaRol = (...roluriPermise) => (req, res, next) => {
  if (!roluriPermise.includes(req.utilizator.Rol.nume))
    return res.status(403).json({ eroare: 'Acces interzis pentru rolul tău' });
  next();
};

module.exports = { verificaToken, verificaRol };