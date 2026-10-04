const express = require('express');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const db = require('../../config/db');

const router = express.Router();

router.get('/plans', authSaasMiddleware, async (_req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT id, code, name, price_monthly, bed_limit, features FROM plans ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/subscriptions', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { plan_id, started_at, current_period_end } = req.body;

    await db.execute(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_end)
       VALUES (?, ?, 'ACTIVE', ?, ?)`,
      [tenantId, plan_id, started_at, current_period_end]
    );

    res.status(201).json({ message: 'Subscription created' });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute(
      `SELECT * FROM invoices WHERE tenant_id = ? ORDER BY id DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
