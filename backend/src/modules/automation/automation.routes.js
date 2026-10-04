const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const { enqueueAutomation } = require('../../jobs/producers/automationProducer');

const router = express.Router();

router.post('/rules', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { name, trigger_type, trigger_config, action_type, action_config } = req.body;

    const [result] = await db.execute(
      `INSERT INTO automation_rules
       (tenant_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
       VALUES (?, ?, ?, ?, ?, ?, true)`,
      [tenantId, name, trigger_type, JSON.stringify(trigger_config), action_type, JSON.stringify(action_config)]
    );

    res.status(201).json({ id: result.insertId, message: 'Rule created' });
  } catch (err) {
    next(err);
  }
});

router.get('/rules', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute(
      `SELECT * FROM automation_rules WHERE tenant_id = ? ORDER BY id DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/rules/:id/run', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const ruleId = Number(req.params.id);

    const [rows] = await db.execute(
      `SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [ruleId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Rule not found' });
    }

    const rule = rows[0];

    await enqueueAutomation({
      tenantId,
      ruleId,
      actionType: rule.action_type,
      payload: JSON.parse(rule.action_config || '{}'),
    });

    res.json({ message: 'Rule execution queued' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
