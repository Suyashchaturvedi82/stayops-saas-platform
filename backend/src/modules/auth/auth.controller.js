const service = require('./auth.service');
const repo = require('./auth.repo');

async function register(req, res, next) {
  try {
    // Workspace scope: explicit body.tenant_slug wins, else pre-auth
    // header (x-tenant-id/slug). Never from an authenticated context.
    let tenantId = null;
    const bodySlug = req.validated.body.tenant_slug;
    if (bodySlug) {
      const tenant = await repo.getTenantBySlug(bodySlug);
      if (!tenant || tenant.status !== 'ACTIVE') {
        return res.status(404).json({ message: 'Workspace not found' });
      }
      tenantId = tenant.id;
    } else if (req.tenant?.id) {
      tenantId = req.tenant.id;
    }
    const result = await service.register(tenantId, req.validated.body);
    res.status(201).json({ message: 'User registered', ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /auth/owner/login — operator-facing (OWNER/MANAGER/ACCOUNTANT/FRONTDESK). */
async function loginOwner(req, res, next) {
  try {
    const result = await service.login(req.tenant?.id, req.validated.body, 'owner');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /auth/tenant/login — resident/tenant-facing (non-operator roles). */
async function loginTenant(req, res, next) {
  try {
    const result = await service.login(req.tenant?.id, req.validated.body, 'tenant');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    // Identity comes from the refresh token signature, not from middleware.
    const result = await service.refresh(req.validated.body);
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
  loginOwner,
  loginTenant,
  refresh,
  me,
};
