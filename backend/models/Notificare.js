const Notificare = sequelize.define('Notificare', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  utilizator_id: { type: DataTypes.INTEGER, allowNull: false },
  titlu: { type: DataTypes.STRING(150), allowNull: false },
  mesaj: { type: DataTypes.TEXT, allowNull: false },
  citita: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'notificari',
  timestamps: true,
  createdAt: 'creat_la',
  updatedAt: false,
});