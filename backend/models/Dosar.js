const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dosar = sequelize.define('Dosar', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numar_dosar:    { type: DataTypes.STRING(50), unique: true },
  tip: {
    type: DataTypes.ENUM(
      'certificat_handicap', 'adoptie', 'plasament',
      'alocatie', 'evaluare_adulti', 'alte_servicii'
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      'depus', 'in_analiza', 'incomplet', 'programat_comisie',
      'aprobat', 'respins', 'arhivat'
    ),
    defaultValue: 'depus',
  },
  prioritate:        { type: DataTypes.ENUM('normal', 'urgent'), defaultValue: 'normal' },
  descriere:         { type: DataTypes.TEXT },
  motiv_respingere:  { type: DataTypes.TEXT },
  termen_limita:     { type: DataTypes.DATE },
  cetatean_id:       { type: DataTypes.INTEGER, allowNull: false },   // fără ă
  functionar_id:     { type: DataTypes.INTEGER },                      // fără ă
  departament:       { type: DataTypes.STRING(100) },
}, {
  tableName: 'dosare',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});

module.exports = Dosar;