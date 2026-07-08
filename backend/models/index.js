const sequelize          = require('../config/database');
const Rol                = require('./Rol');
const Utilizator         = require('./Utilizator');
const ProfilFunctionar   = require('./ProfilFunctionar');
const ProfilMedic        = require('./ProfilMedic');
const ProfilCetatean     = require('./ProfilCetatean');
const Dosar              = require('./Dosar');
const Document           = require('./Document');
const ProgramareComisie  = require('./ProgramareComisie');
const Notificare         = require('./Notificare');
const IstoricActiuni     = require('./IstoricActiuni');
const SolicitareMedicala = require('./SolicitareMedicala');
const SablonDocument     = require('./SablonDocument');

Rol.hasMany(Utilizator, { foreignKey: 'rol_id' });
Utilizator.belongsTo(Rol, { foreignKey: 'rol_id' });


Utilizator.hasOne(ProfilFunctionar, { foreignKey: 'utilizator_id', as: 'profilFunctionar' });
ProfilFunctionar.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

Utilizator.hasOne(ProfilMedic, { foreignKey: 'utilizator_id', as: 'profilMedic' });
ProfilMedic.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

Utilizator.hasOne(ProfilCetatean, { foreignKey: 'utilizator_id', as: 'profilCetatean' });
ProfilCetatean.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

Utilizator.hasMany(Dosar, { foreignKey: 'cetatean_id', as: 'dosareProprii' });
Dosar.belongsTo(Utilizator, { foreignKey: 'cetatean_id', as: 'cetatean' });

Utilizator.hasMany(Dosar, { foreignKey: 'functionar_id', as: 'dosareAlocate' });
Dosar.belongsTo(Utilizator, { foreignKey: 'functionar_id', as: 'functionar' });

Dosar.hasMany(Document, { foreignKey: 'dosar_id' });
Document.belongsTo(Dosar, { foreignKey: 'dosar_id' });

Dosar.hasMany(ProgramareComisie, { foreignKey: 'dosar_id' });
ProgramareComisie.belongsTo(Dosar, { foreignKey: 'dosar_id' });

Utilizator.hasMany(Notificare, { foreignKey: 'utilizator_id' });
Notificare.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

Utilizator.hasMany(IstoricActiuni, { foreignKey: 'utilizator_id' });
IstoricActiuni.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

SolicitareMedicala.belongsTo(Utilizator, { as: 'cetatean', foreignKey: 'cetatean_id' });
SolicitareMedicala.belongsTo(Utilizator, { as: 'medic',    foreignKey: 'medic_id' });
SolicitareMedicala.belongsTo(Dosar,      { as: 'dosar',    foreignKey: 'dosar_id' });

Utilizator.hasMany(SolicitareMedicala, { foreignKey: 'medic_id',    as: 'solicitariPrimite' });
Dosar.hasMany(SolicitareMedicala,      { foreignKey: 'dosar_id',    as: 'solicitari' });

module.exports = {
  sequelize,
  Rol,
  Utilizator,
  ProfilFunctionar,
  ProfilMedic,
  ProfilCetatean,
  Dosar,
  Document,
  ProgramareComisie,
  Notificare,
  IstoricActiuni,
  SolicitareMedicala,
  SablonDocument
};