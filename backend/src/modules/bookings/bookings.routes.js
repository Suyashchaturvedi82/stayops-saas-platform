const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const machine = require('./bookingStateMachine');

const router = express.Router();

const OPERATOR = ['OWNER', 'MANAGER', 'FRONTDESK'];

/**
 * Phase 2 booking engine (strict state machine):
 *   HELD -> PENDING_PAYMENT -> BOOKED -> OCCUPIED -> COMPLETED
 * tenant_id always comes from the verified JWT (authSaasMiddleware).
 */

router.get('/', authSaasMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute('SELECT * FROM bookings WHERE tenant_id = ? ORDER BY id DESC', [tenantId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/my', authSaasMiddleware, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT b.id, b.booking_status, b.check_in_date, b.expected_check_out_date,
              b.total_rent, b.hold_expires_at, r.room_number, bed.bed_number
       FROM bookings b
       JOIN beds bed ON b.bed_id = bed.id
       JOIN rooms r ON bed.room_id = r.id
       WHERE b.user_id = ? AND b.tenant_id = ?
       ORDER BY b.created_at DESC`,
      [req.auth.userId, req.tenant.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Request a bed: AVAILABLE -> HELD (15-minute TTL, race-free). */
router.post('/', authSaasMiddleware, async (req, res, next) => {
  try {
    const { bed_id, check_in_date, expected_check_out_date, special_requests } = req.body;
    if (!bed_id || !check_in_date) {
      return res.status(400).json({ message: 'bed_id and check_in_date are required' });
    }
    const booking = await machine.holdBed({
      tenantId: req.tenant.id,
      userId: req.auth.userId,
      bedId: Number(bed_id),
      checkInDate: check_in_date,
      expectedCheckOutDate: expected_check_out_date || null,
      specialRequests: special_requests || null,
    });
    res.status(201).json({
      message: `Bed held for ${machine.HOLD_TTL_MINUTES} minutes`,
      booking,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/** Resident pays: HELD -> PENDING_PAYMENT (+ payment record). */
router.post('/:id/pay', authSaasMiddleware, async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    const tenantId = req.tenant.id;
    const userId = req.auth.userId;
    const { amount, upi_transaction_id, payment_screenshot_url, payment_for } = req.body;

    const [[booking]] = await db.execute(
      'SELECT id, booking_status, total_rent FROM bookings WHERE id = ? AND tenant_id = ? AND user_id = ? LIMIT 1',
      [bookingId, tenantId, userId]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.booking_status === 'HELD') {
      if (amount && payment_screenshot_url) {
        await db.execute(
          `INSERT INTO payments (tenant_id, user_id, booking_id, payment_for, amount, payment_date, payment_status, upi_transaction_id, payment_screenshot_url)
           VALUES (?, ?, ?, ?, ?, CURDATE(), 'PENDING', ?, ?)`,
          [tenantId, userId, bookingId, payment_for || 'ADVANCE', amount, upi_transaction_id || null, payment_screenshot_url]
        );
      }
      const { booking: updated } = await machine.transitionBooking({
        tenantId,
        bookingId,
        to: 'PENDING_PAYMENT',
        actorUserId: userId,
      });
      return res.json({ message: 'Payment recorded. Awaiting owner approval.', booking: updated });
    }

    res.status(409).json({ message: `Booking is ${booking.booking_status}, payment not accepted` });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/** Owner approves: (HELD ->) PENDING_PAYMENT -> BOOKED. */
router.patch('/:id/approve', authSaasMiddleware, rbacMiddleware(...OPERATOR), async (req, res, next) => {
  try {
    const [[booking]] = await db.execute(
      'SELECT booking_status FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1',
      [Number(req.params.id), req.tenant.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (['BOOKED', 'OCCUPIED', 'COMPLETED', 'APPROVED'].includes(booking.booking_status)) {
      return res.json({ message: 'Booking already approved' });
    }
    if (booking.booking_status === 'PENDING') {
      await machine.transitionBooking({
        tenantId: req.tenant.id,
        bookingId: Number(req.params.id),
        to: 'APPROVED',
        actorUserId: req.auth.userId,
      });
      return res.json({ message: 'Booking approved' });
    }
    await machine.approveBooking({ tenantId: req.tenant.id, bookingId: Number(req.params.id), actorUserId: req.auth.userId });
    res.json({ message: 'Booking approved' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/** Owner rejects: HELD/PENDING_PAYMENT -> REJECTED (bed released). */
router.patch('/:id/reject', authSaasMiddleware, rbacMiddleware(...OPERATOR), async (req, res, next) => {
  try {
    await machine.transitionBooking({
      tenantId: req.tenant.id,
      bookingId: Number(req.params.id),
      to: 'REJECTED',
      actorUserId: req.auth.userId,
      reason: 'Rejected by operator',
    });
    res.json({ message: 'Booking rejected' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/** Owner move-in: BOOKED -> OCCUPIED (resident becomes ACTIVE). */
router.patch('/:id/check-in', authSaasMiddleware, rbacMiddleware(...OPERATOR), async (req, res, next) => {
  try {
    await machine.transitionBooking({
      tenantId: req.tenant.id,
      bookingId: Number(req.params.id),
      to: 'OCCUPIED',
      actorUserId: req.auth.userId,
    });
    res.json({ message: 'Resident checked in' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/** Resident cancels: HELD/PENDING_PAYMENT -> CANCELLED (hold released). */
router.post('/:id/cancel', authSaasMiddleware, async (req, res, next) => {
  try {
    const [[booking]] = await db.execute(
      'SELECT booking_status FROM bookings WHERE id = ? AND tenant_id = ? AND user_id = ? LIMIT 1',
      [Number(req.params.id), req.tenant.id, req.auth.userId]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    await machine.transitionBooking({
      tenantId: req.tenant.id,
      bookingId: Number(req.params.id),
      to: 'CANCELLED',
      actorUserId: req.auth.userId,
      reason: 'Cancelled by resident',
    });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

module.exports = router;
