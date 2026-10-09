const { Worker } = require('bullmq');
const { connection } = require('../queues');
const { expireHold, sweepExpiredHolds } = require('../../modules/bookings/bookingStateMachine');

/**
 * Phase 2 hold expiry.
 *
 * Primary: BullMQ delayed job fired 15 minutes after a bed is HELD.
 * Fallback: a periodic DB sweep reaps overdue holds in case a job was
 * lost (Redis outage, worker downtime). expireHold() re-validates state
 * and expiry inside a transaction, so duplicate fires are no-ops.
 */
const bookingHoldWorker = new Worker(
  'booking-holds',
  async (job) => {
    const { bookingId, tenantId, bedId } = job.data;
    return expireHold({ bookingId, tenantId, bedId });
  },
  { connection }
);

bookingHoldWorker.on('failed', (job, err) => {
  console.error('Booking hold worker failed:', job?.data?.bookingId, err.message);
});

const sweepTimer = setInterval(() => {
  sweepExpiredHolds().catch((err) => console.error('hold sweep error:', err.message));
}, 60 * 1000);
sweepTimer.unref();

module.exports = bookingHoldWorker;
