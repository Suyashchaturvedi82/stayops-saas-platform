const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
};

const queues = {
  remindersQueue: new Queue('reminders', { connection }),
  invoicesQueue: new Queue('invoices', { connection }),
  webhooksQueue: new Queue('webhooks', { connection }),
  reportsQueue: new Queue('reports', { connection }),
  automationsQueue: new Queue('automations', { connection }),
};

module.exports = {
  queues,
  connection,
};
