const { queues } = require('../queues');

async function enqueueAutomation(data) {
  return queues.automationsQueue.add('run-automation-action', data, {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
  });
}

module.exports = {
  enqueueAutomation,
};
