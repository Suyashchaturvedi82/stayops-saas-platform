const { Worker } = require('bullmq');
const db = require('../../config/db');
const { connection } = require('../queues');

const webhookWorker = new Worker(
  'webhooks',
  async (job) => {
    const { provider, eventId, payload, tenantId } = job.data;

    await db.execute(
      `INSERT INTO webhook_events (tenant_id, provider, event_id, payload, processed_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE processed_at = processed_at`,
      [tenantId || null, provider, eventId, JSON.stringify(payload)]
    );

    return { ok: true };
  },
  { connection }
);

webhookWorker.on('failed', (_job, err) => {
  console.error('Webhook worker failed:', err.message);
});

module.exports = webhookWorker;
