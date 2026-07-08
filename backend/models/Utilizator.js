const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Utilizator = sequelize.define('Utilizator', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nume:        { type: DataTypes.STRING(100), allowNull: false },
  prenume:     { type: DataTypes.STRING(100), allowNull: false },
  email:       { type: DataTypes.STRING(150), allowNull: false, unique: true,
                 validate: { isEmail: true } },
  parola_hash: { type: DataTypes.STRING(255), allowNull: false },
  telefon:     { type: DataTypes.STRING(20) },
  cnp:         { type: DataTypes.STRING(13), unique: true },

  // OTP pentru autentificare în 2 pași
  cod_otp:         { type: DataTypes.STRING(6) },
  cod_otp_expiry:  { type: DataTypes.DATE },

  // Stare cont
  email_verificat:      { type: DataTypes.BOOLEAN, defaultValue: false },
  activ:                { type: DataTypes.BOOLEAN, defaultValue: true },
  foto_profil:          { type: DataTypes.STRING(255) },
  judet:                { type: DataTypes.STRING(50) },
  oras:                 { type: DataTypes.STRING(100) },

  rol_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'utilizatori',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});

module.exports = Utilizator;
