const SolicitareMedicala = sequelize.define('SolicitareMedicala', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cetatean_id: { type: DataTypes.INTEGER, allowNull: false },
  medic_id: { type: DataTypes.INTEGER, allowNull: false },
  dosar_id: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM('in_asteptare', 'finalizata', 'respinsa'), // 'finalizata', nu 'finalizat'
    defaultValue: 'in_asteptare',
  },
  document_medical_url: { type: DataTypes.STRING(255) },
  observatii: { type: DataTypes.TEXT },
}, {
  tableName: 'solicitari_medicale',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: 'actualizat_la',
});