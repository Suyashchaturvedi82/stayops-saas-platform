const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Canonical authentication middleware.
 *
 * tenantId / userId / roles are taken EXCLUSIVELY from the verified JWT.
 * A client-supplied x-tenant-id / x-tenant-slug header may only *confirm*
 * the token's tenant (mismatch => 403); it can never change it. When no
 * header is present, the tenant row is loaded from the token's tenant_id.
 */
async function authSaasMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: missing access token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);

    const tenantId = decoded.tenant_id ? Number(decoded.tenant_id) : null;
    if (!decoded.sub || !tenantId) {
      return res.status(401).json({ message: 'Token missing identity claims' });
    }

    req.auth = {
      userId: decoded.sub,
      tenantId,
      roles: decoded.roles || [],
      sessionId: decoded.session_id,
    };

    // Header (if any) may only match the token, never override it.
    if (req.tenant && Number(req.tenant.id) !== tenantId) {
      return res.status(403).json({ message: 'Token tenant mismatch' });
    }

    if (!req.tenant) {
      const [rows] = await db.execute(
        'SELECT id, slug, name, status FROM tenants WHERE id = ? LIMIT 1',
        [tenantId]
      );
      if (rows.length === 0) {
        return res.status(401).json({ message: 'Workspace no longer exists' });
      }
      if (rows[0].status !== 'ACTIVE') {
        return res.status(403).json({ message: 'Tenant is not active' });
      }
      req.tenant = rows[0];
    }

    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

module.exports = authSaasMiddleware;
