const { Worker } = require('bullmq');
const db = require('../../config/db');
const { connection } = require('../queues');

const automationWorker = new Worker(
  'automations',
  async (job) => {
    const { tenantId, ruleId, actionType, payload } = job.data;

    if (actionType === 'APPLY_LATE_FEE') {
      const { invoiceId, amount } = payload;

      await db.execute(
        `INSERT INTO late_fees (tenant_id, invoice_id, rule_id, amount, applied_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [tenantId, invoiceId, ruleId, amount]
      );

      await db.execute(
        `INSERT INTO ledger_entries
         (tenant_id, resident_user_id, entry_type, category, amount, occurred_at, reference_type, reference_id)
         SELECT tenant_id, resident_user_id, 'DEBIT', 'LATE_FEE', ?, NOW(), 'invoice', id
         FROM invoices WHERE id = ? AND tenant_id = ?`,
        [amount, invoiceId, tenantId]
      );
    }

    return { ok: true };
  },
  { connection }
);

automationWorker.on('failed', (_job, err) => {
  console.error('Automation worker failed:', err.message);
});

module.exports = automationWorker;
