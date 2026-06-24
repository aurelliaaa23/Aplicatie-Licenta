const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dosar = sequelize.define('Dosar', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numar_dosar:    { type: DataTypes.STRING(50), allowNull: false, unique: true },
  tip: {
    type: DataTypes.ENUM('certificat_handicap', 'adoptie', 'plasament', 'alocatie', 'indemnizatie','evaluare_adulti', 'alte_servicii'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('depus', 'in_analiza', 'incomplet', 'programat_comisie', 'aprobat', 'respins', 'arhivat'),
    defaultValue: 'depus',
    allowNull: true
  },
  prioritate:        { type: DataTypes.ENUM('normal', 'urgent'), defaultValue: 'normal', allowNull: true },
  descriere:         { type: DataTypes.TEXT, allowNull: true },
  motiv_respingere:  { type: DataTypes.TEXT, allowNull: true },
  termen_limita:     { type: DataTypes.DATE, allowNull: true },
  cetatean_id:       { type: DataTypes.INTEGER, allowNull: false },
  functionar_id:     { type: DataTypes.INTEGER, allowNull: true },
  departament:       { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'dosare',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});

module.exports = Dosar;