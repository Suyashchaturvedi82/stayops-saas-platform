const { queues } = require('../queues');

async function enqueueWebhookEvent(data) {
  return queues.webhooksQueue.add('process-webhook', data, {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

module.exports = {
  enqueueWebhookEvent,
};
