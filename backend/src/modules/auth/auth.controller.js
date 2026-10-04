const service = require('./auth.service');

async function register(req, res, next) {
  try {
    const result = await service.register(req.tenant.id, req.validated.body);
    res.status(201).json({ message: 'User registered', ...result });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await service.login(req.tenant.id, req.validated.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await service.refresh(req.tenant.id, req.auth.userId, req.validated.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  return res.json({
    userId: req.auth.userId,
    tenantId: req.auth.tenantId,
    roles: req.auth.roles,
  });
}

module.exports = {
  register,
  login,
  refresh,
  me,
};
