const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProfilFunctionar = sequelize.define('ProfilFunctionar', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  institutie: { type: DataTypes.STRING(150), allowNull: false },
  departament: { type: DataTypes.STRING(100), allowNull: false }
}, {
  tableName: 'profil_functionar',
  timestamps: false,
});

module.exports = ProfilFunctionar;