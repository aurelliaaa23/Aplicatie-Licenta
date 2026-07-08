const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProgramareComisie = sequelize.define('ProgramareComisie', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  data_ora_programare: { type: DataTypes.DATE, allowNull: false },
  locatie: { type: DataTypes.STRING(255) },
  detalii: { type: DataTypes.TEXT },
}, {
  tableName: 'programari_comisie',   
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});

module.exports = ProgramareComisie;