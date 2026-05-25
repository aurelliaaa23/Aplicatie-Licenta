const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notificare = sequelize.define('Notificare', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false },
  dosar_id: { type: DataTypes.INTEGER },
  titlu: { type: DataTypes.STRING(200), allowNull: false },
  mesaj: { type: DataTypes.TEXT, allowNull: false },
  tip: { type: DataTypes.ENUM('info', 'succes', 'avertizare', 'eroare'), defaultValue: 'info' },
  citita: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'notificari', timestamps: true,
  createdAt: 'creat_la', updatedAt: false });

module.exports = Notificare;