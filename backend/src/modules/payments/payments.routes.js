const express = require('express');
const crypto = require('crypto');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const { enqueueWebhookEvent } = require('../../jobs/producers/webhookProducer');

const router = express.Router();

router.post('/intent', authSaasMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { invoice_id, amount } = req.body;

    const intentId = `pi_${Date.now()}`;
    await db.execute(
      `INSERT INTO payments
       (tenant_id, booking_id, user_id, payment_for, amount, payment_date, payment_status, notes)
       VALUES (?, NULL, ?, 'OTHER', ?, CURDATE(), 'PENDING', ?)`,
      [tenantId, req.auth.userId, amount, `invoice:${invoice_id}|intent:${intentId}`]
    );

    res.status(201).json({ intent_id: intentId, client_secret: `secret_${intentId}` });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'] || '';
    const payload = JSON.stringify(req.body || {});
    const expected = crypto
      .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || 'dev_secret')
      .update(payload)
      .digest('hex');

    if (signature !== expected) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    const eventId = req.body.event_id;
    await enqueueWebhookEvent({
      provider: req.body.provider || 'custom',
      eventId,
      payload: req.body,
      tenantId: req.body.tenant_id || null,
    });

    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

router.post('/refunds', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { payment_id, amount } = req.body;

    await db.execute(
      `INSERT INTO refunds (tenant_id, payment_id, amount, status, gateway_refund_id)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [tenantId, payment_id, amount, `rf_${Date.now()}`]
    );

    res.status(201).json({ message: 'Refund request submitted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
