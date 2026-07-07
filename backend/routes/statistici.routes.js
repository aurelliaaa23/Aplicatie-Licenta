const router = require('express').Router();
const { Dosar, Utilizator, ProgramareComisie, Rol, ProfilFunctionar } = require('../models');
const { verificaToken, verificaRol } = require('../middleware/auth.middleware');
const { Op, fn, col, literal } = require('sequelize');

// ── GET /api/statistici/admin — toate metricile pentru panoul de administrare ──
router.get('/admin', verificaToken, verificaRol('administrator'), async (req, res) => {
  console.log('>>> Ruta /statistici/admin a fost atinsă, utilizator:', req.utilizator?.id, req.utilizator?.Rol?.nume);
    try {
    // 1. Dosare pe status
    const dosarePeStatusRaw = await Dosar.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    });

    // 2. Dosare pe tip
    const dosarePeTipRaw = await Dosar.findAll({
      attributes: ['tip', [fn('COUNT', col('id')), 'total']],
      group: ['tip'],
      raw: true,
    });

    // 3. Dosare pe prioritate
    const dosarePePrioritateRaw = await Dosar.findAll({
      attributes: ['prioritate', [fn('COUNT', col('id')), 'total']],
      group: ['prioritate'],
      raw: true,
    });

    // 4. Load pe fiecare funcționar (funcționar + manager)
    const roluriFunc = await Rol.findAll({ where: { nume: { [Op.in]: ['funcționar', 'manager'] } } });
    const idsRoluri = roluriFunc.map(r => r.id);

    const functionari = await Utilizator.findAll({
      where: { rol_id: { [Op.in]: idsRoluri }, activ: true },
      attributes: ['id', 'nume', 'prenume'],
      include: [{ model: ProfilFunctionar, as: 'profilFunctionar', attributes: ['departament'] }],
    });

    const dosarePeFunctionar = await Promise.all(functionari.map(async (f) => {
      const total     = await Dosar.count({ where: { functionar_id: f.id } });
      const aprobate  = await Dosar.count({ where: { functionar_id: f.id, status: 'aprobat' } });
      const respinse  = await Dosar.count({ where: { functionar_id: f.id, status: 'respins' } });
      const inLucru   = await Dosar.count({ where: { functionar_id: f.id, status: { [Op.in]: ['depus', 'in_analiza', 'incomplet', 'programat_comisie'] } } });
      return {
        id: f.id, nume: `${f.prenume} ${f.nume}`,
        departament: f.profilFunctionar?.departament || 'Nespecificat',
        total, aprobate, respinse, inLucru,
      };
    }));

    // 7b. Dosare per cetățean, cu detaliere pe tip de dosar
    const dosarePeCetateanTipRaw = await Dosar.findAll({
      attributes: ['cetatean_id', 'tip', [fn('COUNT', col('id')), 'total']],
      group: ['cetatean_id', 'tip'],
      raw: true,
    });

    const cetateanIds = [...new Set(dosarePeCetateanTipRaw.map(r => r.cetatean_id))];
    const cetateniInfo = await Utilizator.findAll({
      where: { id: { [Op.in]: cetateanIds } },
      attributes: ['id', 'nume', 'prenume'],
      raw: true,
    });
    const cetateniMap = Object.fromEntries(cetateniInfo.map(c => [c.id, `${c.prenume} ${c.nume}`]));

    const dosarePeCetateanMap = {};
    dosarePeCetateanTipRaw.forEach(r => {
      if (!dosarePeCetateanMap[r.cetatean_id]) {
        dosarePeCetateanMap[r.cetatean_id] = {
          id: r.cetatean_id,
          nume: cetateniMap[r.cetatean_id] || `Cetățean #${r.cetatean_id}`,
          total: 0, perTip: {},
        };
      }
      dosarePeCetateanMap[r.cetatean_id].total += parseInt(r.total, 10);
      dosarePeCetateanMap[r.cetatean_id].perTip[r.tip] = parseInt(r.total, 10);
    });
    const dosarePeCetatean = Object.values(dosarePeCetateanMap).sort((a, b) => b.total - a.total);

    // 5. Programări comisie pe status
    // 5. Programări comisie — statusul e derivat din dată (tabela nu are coloană "status")
    const toateProgramarile = await ProgramareComisie.findAll({ attributes: ['id', 'data_ora_programare'], raw: true });
    const acum = new Date();
    const programariPeStatusRaw = [
      { status: 'realizat', total: toateProgramarile.filter(p => new Date(p.data_ora_programare) < acum).length },
      { status: 'programat', total: toateProgramarile.filter(p => new Date(p.data_ora_programare) >= acum).length },
    ];

    // 6. Trend dosare depuse pe lună (ultimele 6 luni)
    const sasesLuni = new Date();
    sasesLuni.setMonth(sasesLuni.getMonth() - 5);
    sasesLuni.setDate(1);
    sasesLuni.setHours(0, 0, 0, 0);

    const dosareTrendRaw = await Dosar.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('creat_la'), '%Y-%m'), 'luna'],
        [fn('COUNT', col('id')), 'total'],
      ],
      where: { creat_la: { [Op.gte]: sasesLuni } },
      group: [literal('luna')],
      order: [[literal('luna'), 'ASC']],
      raw: true,
    });

    // 7. Totaluri generale
    const totalDosare       = await Dosar.count();
    const totalProgramari   = await ProgramareComisie.count();
    const totalAprobate     = await Dosar.count({ where: { status: 'aprobat' } });
    const totalRespinse     = await Dosar.count({ where: { status: 'respins' } });
    const totalInLucru      = await Dosar.count({ where: { status: { [Op.in]: ['depus', 'in_analiza', 'incomplet', 'programat_comisie'] } } });
    const totalUtilizatori  = await Utilizator.count({ where: { activ: true } });
    const totalCetateni     = await Utilizator.count({ where: { activ: true }, include: [{ model: Rol, where: { nume: 'cetățean' } }] });

    res.json({
      totaluri: {
        totalDosare, totalProgramari, totalAprobate, totalRespinse, totalInLucru,
        totalUtilizatori, totalCetateni,
        rataAprobare: totalDosare > 0 ? Math.round((totalAprobate / totalDosare) * 100) : 0,
        rataResp: totalDosare > 0 ? Math.round((totalRespinse / totalDosare) * 100) : 0,
      },
      dosarePeStatus: dosarePeStatusRaw,
      dosarePeTip: dosarePeTipRaw,
      dosarePePrioritate: dosarePePrioritateRaw,
      dosarePeFunctionar,
      dosarePeCetatean,
      programariPeStatus: programariPeStatusRaw,
      dosareTrend: dosareTrendRaw,
    });
  } catch (err) {
    console.error('Eroare statistici admin:', err);
    res.status(500).json({ eroare: err.message });
  }
});

module.exports = router;