const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProgramareComisie = sequelize.define('ProgramareComisie', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  funcționar_id: { type: DataTypes.INTEGER, allowNull: false },
  tip_comisie: {
    type: DataTypes.ENUM('protectia_copilului', 'adoptii', 'evaluare_adulti', 'handicap'),
    allowNull: false,
  },
  data_ora: { type: DataTypes.DATE, allowNull: false },
  durata_minute: { type: DataTypes.INTEGER, defaultValue: 30 },
  locatie: { type: DataTypes.STRING(200) },
  status: { type: DataTypes.ENUM('programat', 'realizat', 'anulat'), defaultValue: 'programat' },
  notificat_email: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'programari_comisii', timestamps: true,
  createdAt: 'creat_la', updatedAt: false });

module.exports = ProgramareComisie;