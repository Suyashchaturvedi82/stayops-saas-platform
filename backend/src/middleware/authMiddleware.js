const jwt = require('jsonwebtoken');

/**
 * Compatibility auth middleware for the legacy route stack.
 * tenant_id / roles are taken exclusively from the verified JWT —
 * legacy tokens without a tenant claim are rejected because every
 * query behind this middleware is tenant-scoped.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );

    const tenantId = decoded.tenant_id ? Number(decoded.tenant_id) : null;
    if (!tenantId) {
      return res.status(401).json({ message: 'Token missing tenant claim. Please sign in again.' });
    }

    const roles = decoded.roles || [];
    req.user = {
      id: Number(decoded.sub || decoded.id),
      email: decoded.email,
      roles,
      tenant_id: tenantId,
    };
    req.tenantId = tenantId;
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

const checkRole = (...allowedRoles) => (req, res, next) => {
  const roles = req.user?.roles || [];
  const expandedRoles = new Set(roles);

  // Preserve the old ADMIN contract while using the richer SaaS roles.
  if (roles.some((role) => ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK'].includes(role))) {
    expandedRoles.add('ADMIN');
  }

  const isAllowed = allowedRoles.some((role) => expandedRoles.has(role));

  if (!isAllowed) {
    return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
  }

  next();
};

module.exports = { verifyToken, checkRole };
