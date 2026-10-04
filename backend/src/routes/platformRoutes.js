const express = require('express');
const db = require('../config/db');
const authSaasMiddleware = require('../middleware/authSaasMiddleware');

const router = express.Router();

// Tenant creation now belongs to the atomic /api/onboarding flow.
router.post('/tenants', (_req, res) => {
  res.status(410).json({ message: 'Use /api/onboarding to create a workspace and owner account together.' });
});

router.get('/workspace', authSaasMiddleware, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, slug, status, created_at FROM tenants WHERE id = ? LIMIT 1',
      [req.auth.tenantId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
});

router.get('/tenants', (_req, res) => {
  res.status(410).json({ message: 'Cross-tenant listing is disabled. Use /api/onboarding and /api/platform/workspace.' });
});

module.exports = router;
