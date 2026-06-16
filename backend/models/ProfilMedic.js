const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProfilMedic = sequelize.define('ProfilMedic', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  specialitate: { type: DataTypes.STRING(100), allowNull: false }
}, {
  tableName: 'profil_medic',
  timestamps: false,
});

module.exports = ProfilMedic;