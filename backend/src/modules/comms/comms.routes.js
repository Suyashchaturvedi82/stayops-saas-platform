const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const { queues } = require('../../jobs/queues');

const router = express.Router();

router.post('/templates', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { channel, key_name, subject, body } = req.body;
    await db.execute(
      `INSERT INTO notification_templates (tenant_id, channel, key_name, subject, body)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE subject = VALUES(subject), body = VALUES(body)`,
      [tenantId, channel, key_name, subject || null, body]
    );
    res.status(201).json({ message: 'Template saved' });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'FRONTDESK'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { user_id, channel, template_key, payload } = req.body;

    const [result] = await db.execute(
      `INSERT INTO notifications (tenant_id, user_id, channel, template_key, payload, status)
       VALUES (?, ?, ?, ?, ?, 'QUEUED')`,
      [tenantId, user_id, channel, template_key || null, JSON.stringify(payload || {})]
    );

    await queues.remindersQueue.add('dispatch-notification', {
      tenantId,
      notificationId: result.insertId,
    });

    res.status(201).json({ message: 'Notification queued', id: result.insertId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
