const rateLimit = require('express-rate-limit');

const rateLimitPerTenant = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const tenantId = req.tenant?.id || 'public';
    return `${tenantId}:${req.ip}`;
  },
  handler: (_req, res) => {
    return res.status(429).json({ message: 'Too many requests for this tenant. Please retry later.' });
  },
});

module.exports = rateLimitPerTenant;
