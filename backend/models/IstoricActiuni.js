const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IstoricActiuni = sequelize.define('IstoricActiuni', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false },
  dosar_id: { type: DataTypes.INTEGER },
  actiune: { type: DataTypes.STRING(200), allowNull: false },
  detalii: { type: DataTypes.JSON },
  ip_adresa: { type: DataTypes.STRING(45) },
}, { tableName: 'istoric_actiuni', timestamps: true,
  createdAt: 'efectuat_la', updatedAt: false });

module.exports = IstoricActiuni;