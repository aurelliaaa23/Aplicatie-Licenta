const sequelize       = require('../config/database');
const Rol             = require('./Rol');
const Utilizator      = require('./Utilizator');
const Dosar           = require('./Dosar');
const Document        = require('./Document');
const ProgramareComisie = require('./ProgramareComisie');
const Notificare      = require('./Notificare');
const IstoricActiuni  = require('./IstoricActiuni');

// ── Relații ───────────────────────────────────────────────
Rol.hasMany(Utilizator, { foreignKey: 'rol_id' });
Utilizator.belongsTo(Rol, { foreignKey: 'rol_id' });

// Cetățean ↔ Dosar
Utilizator.hasMany(Dosar, { foreignKey: 'cetatean_id', as: 'dosareProprii' });
Dosar.belongsTo(Utilizator, { foreignKey: 'cetatean_id', as: 'cetatean' });

// Funcționar ↔ Dosar
Utilizator.hasMany(Dosar, { foreignKey: 'functionar_id', as: 'dosareAlocate' });
Dosar.belongsTo(Utilizator, { foreignKey: 'functionar_id', as: 'functionar' });

// Dosar ↔ Document
Dosar.hasMany(Document, { foreignKey: 'dosar_id' });
Document.belongsTo(Dosar, { foreignKey: 'dosar_id' });

// Dosar ↔ Programare
Dosar.hasMany(ProgramareComisie, { foreignKey: 'dosar_id' });
ProgramareComisie.belongsTo(Dosar, { foreignKey: 'dosar_id' });

// Utilizator ↔ Notificare
Utilizator.hasMany(Notificare, { foreignKey: 'utilizator_id' });
Notificare.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

// Utilizator ↔ Istoric
Utilizator.hasMany(IstoricActiuni, { foreignKey: 'utilizator_id' });
IstoricActiuni.belongsTo(Utilizator, { foreignKey: 'utilizator_id' });

module.exports = {
  sequelize,
  Rol, Utilizator, Dosar, Document,
  ProgramareComisie, Notificare, IstoricActiuni,
};