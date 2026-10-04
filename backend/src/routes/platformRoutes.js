const express = require('express');
const db = require('../config/db');
const authSaasMiddleware = require('../middleware/authSaasMiddleware');

const router = express.Router();

// =====================================================
// ATOMIC WORKSPACE & OWNER ONBOARDING
// =====================================================
router.post('/onboarding', async (req, res, next) => {
  try {
    const { name, slug, ownerName, email, phone, gender, password } = req.body;

    // 1. Create the Workspace (Tenant)
    const [tenant] = await db.execute(
      'INSERT INTO tenants (name, slug, status) VALUES (?, ?, ?)',
      [name, slug, 'ACTIVE']
    );

    // 2. Create the Owner Account
    const [user] = await db.execute(
      'INSERT INTO users (tenant_id, email, password_hash, first_name, phone, gender) VALUES (?, ?, ?, ?, ?, ?)',
      [tenant.insertId, email, password, ownerName, phone, gender]
    );

    res.status(201).json({ 
      success: true,
      message: 'Workspace created successfully!',
      tenantId: tenant.insertId,
      userId: user.insertId
    });
  } catch (err) {
    console.error('Onboarding Error:', err);
    res.status(500).json({ message: 'Failed to create workspace', error: err.message });
  }
});

// =====================================================
// EXISTING ROUTES
// =====================================================

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