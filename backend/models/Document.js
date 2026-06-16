const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  nume_fisier: { type: DataTypes.STRING(255), allowNull: false },
  cale_fisier: { type: DataTypes.STRING(255), allowNull: false },
  tip_document: { type: DataTypes.STRING(100) },
  status_document: {
    type: DataTypes.ENUM('incarcat', 'validat', 'ilizibil', 'incomplet'),
    defaultValue: 'incarcat',
  },
  motiv_respingere: { type: DataTypes.TEXT },
  semnat_digital: { type: DataTypes.BOOLEAN, defaultValue: false },
  date_semnatura: { type: DataTypes.TEXT },
}, {
  tableName: 'documente',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});

module.exports = Document;