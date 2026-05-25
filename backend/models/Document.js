const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false },
  tip_document: {
    type: DataTypes.ENUM('carte_identitate', 'certificat_medical', 'ancheta_sociala',
      'referat', 'decizie', 'semnatura', 'alte'),
    allowNull: false,
  },
  nume_fisier: { type: DataTypes.STRING(255) },
  cale_fisier: { type: DataTypes.STRING(500) },
  marime_bytes: { type: DataTypes.INTEGER },
  semnatura_base64: { type: DataTypes.TEXT('long') }, // pentru draw-to-sign
  metadata_semnatura: { type: DataTypes.JSON },   // timestamp, user_id, ip
  validat: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'documente', timestamps: true,
  createdAt: 'incarcat_la', updatedAt: false });

module.exports = Document;