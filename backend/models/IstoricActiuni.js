const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IstoricActiuni = sequelize.define('IstoricActiuni', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false },
  actiune: { type: DataTypes.STRING(255), allowNull: false },
  detalii: { type: DataTypes.TEXT },          // TEXT, nu JSON
  adresa_ip: { type: DataTypes.STRING(50) },  // adresa_ip, nu ip_adresa
}, {
  tableName: 'istoric_actiuni',
  timestamps: true,
  createdAt: 'creat_la',   // nu efectuat_la
  updatedAt: false,
});

module.exports = IstoricActiuni;