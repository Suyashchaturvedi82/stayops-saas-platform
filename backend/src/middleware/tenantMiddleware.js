const db = require('../config/db');

async function tenantMiddleware(req, res, next) {
  const tenantSlug = req.headers['x-tenant-slug'];
  const tenantIdHeader = req.headers['x-tenant-id'];

  if (!tenantSlug && !tenantIdHeader) {
    return res.status(400).json({ message: 'Tenant header missing. Use x-tenant-id or x-tenant-slug.' });
  }

  try {
    let query;
    let params;

    if (tenantIdHeader) {
      const tenantId = Number(tenantIdHeader);
      if (!Number.isInteger(tenantId) || tenantId <= 0) {
        return res.status(400).json({ message: 'Invalid tenant id' });
      }
      query = 'SELECT id, slug, name, status FROM tenants WHERE id = ? LIMIT 1';
      params = [tenantId];
    } else {
      query = 'SELECT id, slug, name, status FROM tenants WHERE slug = ? LIMIT 1';
      params = [String(tenantSlug).trim().toLowerCase()];
    }

    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    if (rows[0].status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Tenant is not active' });
    }

    req.tenant = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenantMiddleware;
