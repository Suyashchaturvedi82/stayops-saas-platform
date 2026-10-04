const jwt = require('jsonwebtoken');

function authSaasMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: missing access token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
    req.auth = {
      userId: decoded.sub || decoded.id,
      tenantId: decoded.tenant_id,
      roles: decoded.roles || [],
      sessionId: decoded.session_id,
    };

    if (req.tenant?.id && req.auth.tenantId && Number(req.auth.tenantId) !== Number(req.tenant.id)) {
      return res.status(403).json({ message: 'Token tenant mismatch' });
    }

    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

module.exports = authSaasMiddleware;
