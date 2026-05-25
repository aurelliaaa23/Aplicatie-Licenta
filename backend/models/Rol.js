const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rol = sequelize.define('Rol', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nume: {
    type: DataTypes.ENUM('cetățean', 'funcționar', 'medic', 'funcționar_primărie',
      'reprezentant_școală', 'manager', 'administrator'),
    allowNull: false,
    unique: true,
  },
}, { tableName: 'roluri', timestamps: false });

module.exports = Rol;