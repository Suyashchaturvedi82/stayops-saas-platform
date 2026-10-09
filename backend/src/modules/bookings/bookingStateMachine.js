const db = require('../../config/db');
const redis = require('../../config/redis');
const { queues } = require('../../jobs/queues');

/**
 * Booking / bed state machine (Phase 2).
 *
 * Strict chain:
 *   AVAILABLE -> HELD (15-min TTL) -> PENDING_PAYMENT -> BOOKED -> OCCUPIED
 *
 * Every transition runs inside a transaction with the booking/bed rows
 * locked FOR UPDATE, so concurrent requests are serialised — no more
 * check-then-insert races or double bookings.
 *
 * Hold expiry is enforced two ways:
 *   1. BullMQ delayed job (booking-holds queue, 15 min) — prompt revert.
 *   2. DB sweep + lazy expiry on the next claim attempt — authoritative
 *      fallback when Redis/the worker is unavailable.
 * Redis also carries an advisory TTL key (hold:bed:<id>) for visibility.
 */

const HOLD_TTL_MINUTES = 15;
const HOLD_TTL_MS = HOLD_TTL_MINUTES * 60 * 1000;

/** Booking states that count as "active" for a user in a tenant. */
const ACTIVE_BOOKING_STATES = ['HELD', 'PENDING_PAYMENT', 'BOOKED', 'OCCUPIED', 'PENDING', 'APPROVED'];

/** Strict transition map. Unknown states have no transitions. */
const TRANSITIONS = {
  HELD: ['PENDING_PAYMENT', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  PENDING_PAYMENT: ['BOOKED', 'REJECTED', 'CANCELLED'],
  BOOKED: ['OCCUPIED', 'CANCELLED'],
  OCCUPIED: ['COMPLETED'],
  // Legacy states kept for pre-existing rows.
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['OCCUPIED', 'CANCELLED', 'COMPLETED'],
};

/** Bed status implied by a booking state (null = bed untouched). */
const BED_FOR_BOOKING = {
  HELD: 'HELD',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  BOOKED: 'BOOKED',
  OCCUPIED: 'OCCUPIED',
  APPROVED: 'BOOKED',
  PENDING: null,
  // Terminal states release the bed back to AVAILABLE (handled below).
  REJECTED: 'AVAILABLE',
  CANCELLED: 'AVAILABLE',
  EXPIRED: 'AVAILABLE',
  COMPLETED: 'AVAILABLE',
};

const TERMINAL_RELEASE = ['REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED'];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw httpError(409, `Invalid booking state transition: ${from} -> ${to}`);
  }
}

/* ------------------------------------------------------------------ */
/* Best-effort Redis helpers — the DB stays authoritative.             */
/* ------------------------------------------------------------------ */

const HOLD_KEY_TTL_SEC = HOLD_TTL_MINUTES * 60;

function redisSetHold(bedId, bookingId) {
  if (!redis) return Promise.resolve();
  return redis
    .set(`hold:bed:${bedId}`, String(bookingId), 'EX', HOLD_KEY_TTL_SEC)
    .catch(() => {});
}

function redisReleaseHold(bedId) {
  if (!redis) return Promise.resolve();
  return redis.del(`hold:bed:${bedId}`).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* BullMQ delayed job (prompt expiry)                                  */
/* ------------------------------------------------------------------ */

async function enqueueHoldExpiry(booking) {
  try {
    await queues.bookingHoldsQueue.add(
      'expire-hold',
      { bookingId: booking.id, tenantId: booking.tenant_id, bedId: booking.bed_id },
      {
        delay: HOLD_TTL_MS,
        // Unique id: stale jobs for the same booking are harmless because
        // expireHold() re-checks state + expiry inside a transaction.
        jobId: `hold-${booking.id}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  } catch (err) {
    // Redis outage must not break booking creation — the DB sweep and
    // lazy expiry still enforce the TTL.
    console.error('hold expiry enqueue failed:', err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Claim a bed: AVAILABLE -> HELD (race-free)                          */
/* ------------------------------------------------------------------ */

/**
 * Creates a booking in HELD state and locks the bed for 15 minutes.
 * All checks happen under row locks, so two concurrent requests for the
 * same bed are serialised and the loser gets a clean 409.
 */
async function holdBed({
  tenantId,
  userId,
  bedId,
  checkInDate,
  expectedCheckOutDate = null,
  specialRequests = null,
}) {
  const conn = await db.getConnection();
  let booking;
  try {
    await conn.beginTransaction();

    const [bedRows] = await conn.execute(
      'SELECT id, status, is_available, rent_per_month FROM beds WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [bedId, tenantId]
    );
    if (bedRows.length === 0) throw httpError(404, 'Bed not found');
    const bed = bedRows[0];

    // A live hold by someone else blocks the claim; an expired one is
    // reaped inline (lazy expiry) before we proceed.
    const [holdRows] = await conn.execute(
      `SELECT id, user_id, hold_expires_at FROM bookings
       WHERE bed_id = ? AND tenant_id = ? AND booking_status = 'HELD'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [bedId, tenantId]
    );
    if (holdRows.length > 0) {
      const live = holdRows[0].hold_expires_at && new Date(holdRows[0].hold_expires_at) > new Date();
      if (live) {
        throw httpError(409, 'Bed is on hold for another request. Please try again after the hold expires.');
      }
      await conn.execute(
        `UPDATE bookings SET booking_status = 'EXPIRED', cancelled_at = NOW(), cancellation_reason = 'Hold expired'
         WHERE id = ? AND booking_status = 'HELD'`,
        [holdRows[0].id]
      );
      await conn.execute(
        `UPDATE beds SET status = 'AVAILABLE', is_available = 1 WHERE id = ? AND status = 'HELD'`,
        [bedId]
      );
      bed.status = 'AVAILABLE';
    }

    if (bed.status !== 'AVAILABLE') {
      throw httpError(409, 'Bed is not available for booking');
    }

    // One active booking per user per workspace (legacy contract).
    const [activeRows] = await conn.execute(
      `SELECT id FROM bookings
       WHERE tenant_id = ? AND user_id = ? AND booking_status IN (${ACTIVE_BOOKING_STATES.map(() => '?').join(',')})
       LIMIT 1`,
      [tenantId, userId, ...ACTIVE_BOOKING_STATES]
    );
    if (activeRows.length > 0) {
      throw httpError(400, 'You already have an active booking in this workspace');
    }

    const [result] = await conn.execute(
      `INSERT INTO bookings
        (tenant_id, user_id, bed_id, check_in_date, expected_check_out_date,
         booking_status, hold_expires_at, special_requests, total_rent)
       VALUES (?, ?, ?, ?, ?, 'HELD', NOW() + INTERVAL ? MINUTE, ?, ?)`,
      [tenantId, userId, bedId, checkInDate, expectedCheckOutDate, HOLD_TTL_MINUTES, specialRequests, bed.rent_per_month]
    );

    await conn.execute(
      `UPDATE beds SET status = 'HELD', is_available = 0 WHERE id = ? AND tenant_id = ?`,
      [bedId, tenantId]
    );

    await conn.commit();

    const [[created]] = await db.execute('SELECT * FROM bookings WHERE id = ? LIMIT 1', [result.insertId]);
    booking = created;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Post-commit side effects (best-effort, never fail the request).
  await redisSetHold(booking.bed_id, booking.id);
  await enqueueHoldExpiry(booking);
  return booking;
}

/* ------------------------------------------------------------------ */
/* Generic guarded transition (single step)                            */
/* ------------------------------------------------------------------ */

/**
 * Moves a booking to `to` (one strict step), keeping the bed in sync.
 * `actorUserId` records admin approval / cancellation metadata.
 */
async function transitionBooking({ tenantId, bookingId, to, actorUserId = null, reason = null }) {
  const conn = await db.getConnection();
  let outcome;
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM bookings WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [bookingId, tenantId]
    );
    if (rows.length === 0) throw httpError(404, 'Booking not found');
    const booking = rows[0];
    const from = booking.booking_status;

    if (from === to) {
      outcome = { booking, alreadyInState: true };
      await conn.commit();
      return outcome;
    }

    assertTransition(from, to);

    const updates = ['booking_status = ?'];
    const params = [to];

    if (to === 'BOOKED') {
      updates.push('admin_approved_by = ?', 'admin_approved_at = NOW()');
      params.push(actorUserId);
    }
    if (to === 'REJECTED' || to === 'CANCELLED' || to === 'EXPIRED') {
      updates.push('cancelled_by = ?', 'cancelled_at = NOW()', 'cancellation_reason = ?');
      params.push(actorUserId, reason || (to === 'EXPIRED' ? 'Hold expired' : `${to.charAt(0)}${to.slice(1).toLowerCase()}`));
    }

    await conn.execute(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, [...params, bookingId]);

    const bedTarget = BED_FOR_BOOKING[to];
    if (bedTarget) {
      await conn.execute('UPDATE beds SET status = ?, is_available = ? WHERE id = ? AND tenant_id = ?', [
        bedTarget,
        bedTarget === 'AVAILABLE' ? 1 : 0,
        booking.bed_id,
        tenantId,
      ]);
    }

    // Resident lifecycle: created at BOOKED, activated at OCCUPIED.
    if (to === 'BOOKED' || to === 'OCCUPIED') {
      const [existingResident] = await conn.execute(
        'SELECT id FROM residents WHERE booking_id = ? LIMIT 1',
        [bookingId]
      );
      if (existingResident.length === 0) {
        await conn.execute(
          `INSERT INTO residents (tenant_id, booking_id, user_id, bed_id, move_in_date, expected_move_out_date, resident_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, bookingId, booking.user_id, booking.bed_id, booking.check_in_date, booking.expected_check_out_date, to === 'OCCUPIED' ? 'ACTIVE' : 'PENDING_APPROVAL']
        );
      } else if (to === 'OCCUPIED') {
        await conn.execute(`UPDATE residents SET resident_status = 'ACTIVE' WHERE booking_id = ?`, [bookingId]);
      }
    }

    const [[updated]] = await conn.execute('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    await conn.commit();
    outcome = { booking: updated, alreadyInState: false };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  if (to !== 'HELD') await redisReleaseHold(outcome.booking.bed_id);
  return outcome;
}

/**
 * Owner approval. Strict order is preserved: a HELD booking passes
 * through PENDING_PAYMENT before reaching BOOKED (payment acknowledged
 * as part of approval in the operator flow).
 */
async function approveBooking({ tenantId, bookingId, actorUserId }) {
  const first = await transitionBooking({
    tenantId,
    bookingId,
    to: 'PENDING_PAYMENT',
    actorUserId,
    reason: 'Payment acknowledged on approval',
  });
  if (first.booking.booking_status !== 'PENDING_PAYMENT') return first;
  return transitionBooking({ tenantId, bookingId, to: 'BOOKED', actorUserId });
}

/* ------------------------------------------------------------------ */
/* Hold expiry (worker + sweep + lazy)                                 */
/* ------------------------------------------------------------------ */

/** Idempotent: expires a HELD booking iff its TTL has elapsed. */
async function expireHold({ bookingId, tenantId = null, bedId = null }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const params = [bookingId];
    let sql = 'SELECT * FROM bookings WHERE id = ?';
    if (tenantId) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }
    const [rows] = await conn.execute(`${sql} FOR UPDATE`, params);
    if (rows.length === 0) return { expired: false, reason: 'not-found' };
    const booking = rows[0];

    if (booking.booking_status !== 'HELD') return { expired: false, reason: 'not-held' };
    if (booking.hold_expires_at && new Date(booking.hold_expires_at) > new Date()) {
      return { expired: false, reason: 'not-expired' };
    }

    await conn.execute(
      `UPDATE bookings SET booking_status = 'EXPIRED', cancelled_at = NOW(), cancellation_reason = 'Hold expired'
       WHERE id = ? AND booking_status = 'HELD'`,
      [booking.id]
    );
    await conn.execute(
      `UPDATE beds SET status = 'AVAILABLE', is_available = 1 WHERE id = ? AND status = 'HELD'`,
      [booking.bed_id]
    );

    await conn.commit();
    await redisReleaseHold(booking.bed_id);
    return { expired: true, bookingId: booking.id, bedId: booking.bed_id };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** DB fallback sweep: reaps every overdue HELD booking (idempotent). */
async function sweepExpiredHolds(limit = 100) {
  // mysql2's binary protocol cannot bind LIMIT ? — inline a safe integer.
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const [rows] = await db.execute(
    `SELECT id, tenant_id, bed_id FROM bookings
     WHERE booking_status = 'HELD' AND hold_expires_at IS NOT NULL AND hold_expires_at <= NOW()
     LIMIT ${safeLimit}`
  );
  let reaped = 0;
  for (const row of rows) {
    try {
      const result = await expireHold({ bookingId: row.id, tenantId: row.tenant_id, bedId: row.bed_id });
      if (result.expired) reaped++;
    } catch (err) {
      console.error('hold sweep failed for booking', row.id, err.message);
    }
  }
  return reaped;
}

module.exports = {
  HOLD_TTL_MINUTES,
  HOLD_TTL_MS,
  TRANSITIONS,
  ACTIVE_BOOKING_STATES,
  assertTransition,
  holdBed,
  transitionBooking,
  approveBooking,
  expireHold,
  sweepExpiredHolds,
};
