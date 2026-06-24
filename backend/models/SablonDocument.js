const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SablonDocument = sequelize.define('SablonDocument', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nume_sablon: { type: DataTypes.STRING(150), allowNull: false },
  tip_dosar: {
    type: DataTypes.ENUM('certificat_handicap','adoptie','plasament','alocatie', 'indemnizatie','evaluare_adulti','alte_servicii'),
    allowNull: false,
  },
  continut_html: { type: DataTypes.TEXT, allowNull: false },
}, {
  tableName: 'sabloane_documente',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: false,
});
module.exports = SablonDocument;