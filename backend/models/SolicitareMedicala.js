const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SolicitareMedicala = sequelize.define('SolicitareMedicala', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  medic_id: { type: DataTypes.INTEGER, allowNull: false },
  cetatean_id: { type: DataTypes.INTEGER, allowNull: false },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM('in_asteptare', 'finalizat'),
    defaultValue: 'in_asteptare'
  }
}, {
  tableName: 'solicitari_medicale',
  timestamps: true
});

module.exports = SolicitareMedicala;