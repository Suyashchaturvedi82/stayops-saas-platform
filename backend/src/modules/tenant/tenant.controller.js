const service = require('./tenant.service');

async function createTenant(req, res, next) {
  try {
    const result = await service.createTenant(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listTenants(_req, res, next) {
  try {
    const rows = await service.listTenants();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTenant,
  listTenants,
};
