const jwt = require('jsonwebtoken');

/**
 * Compatibility auth middleware.
 * Supports both the original ADMIN/USER tokens and the upgraded tenant-aware tokens.
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

    const roles = decoded.roles || [];
    req.user = {
      id: Number(decoded.sub || decoded.id),
      email: decoded.email,
      roles,
      tenant_id: decoded.tenant_id ? Number(decoded.tenant_id) : undefined,
    };
    req.tenantId = req.user.tenant_id;
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
