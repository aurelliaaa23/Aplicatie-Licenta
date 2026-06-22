const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProfilCetatean = sequelize.define('ProfilCetatean', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  adresa_completa: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'profil_cetatean',
  timestamps: false,
});

module.exports = ProfilCetatean;