const db = require('../config/db');
const machine = require('../modules/bookings/bookingStateMachine');

/**
 * POST /api/bookings — request a bed.
 * Phase 2: this is the HELD step of the state machine. The bed is claimed
 * inside a transaction (row locks), so concurrent requests can no longer
 * double-book; the hold expires after 15 minutes if nothing follows.
 */
const createBooking = async (req, res) => {
  const { bed_id, check_in_date, expected_check_out_date, special_requests } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
  if (!bed_id || !check_in_date) return res.status(400).json({ message: 'Bed ID and check-in date are required' });

  try {
    const booking = await machine.holdBed({
      tenantId,
      userId,
      bedId: bed_id,
      checkInDate: check_in_date,
      expectedCheckOutDate: expected_check_out_date || null,
      specialRequests: special_requests || null,
    });
    res.status(201).json({
      message: `Bed held for ${machine.HOLD_TTL_MINUTES} minutes. Complete payment and await owner approval.`,
      bookingId: booking.id,
      status: booking.booking_status,
      hold_expires_at: booking.hold_expires_at,
    });
  } catch (error) {
    if (!error.statusCode) console.error('Create Booking Error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const [bookings] = await db.execute(
      `SELECT b.id, b.booking_status, b.check_in_date, b.expected_check_out_date,
              b.total_rent, b.hold_expires_at, r.room_number, bed.bed_number
       FROM bookings b
       JOIN beds bed ON b.bed_id = bed.id
       JOIN rooms r ON bed.room_id = r.id
       WHERE b.user_id = ? AND b.tenant_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id, req.user.tenant_id]
    );
    res.json(bookings);
  } catch (error) {
    console.error('Get My Bookings Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Queue: requests awaiting operator action (held or awaiting payment). */
const getPendingBookings = async (req, res) => {
  try {
    const [bookings] = await db.execute(
      `SELECT b.id, b.check_in_date, b.booking_status, b.hold_expires_at, u.email,
              r.room_number, bed.bed_number
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN beds bed ON b.bed_id = bed.id
       JOIN rooms r ON bed.room_id = r.id
       WHERE b.booking_status IN ('HELD', 'PENDING_PAYMENT', 'PENDING') AND b.tenant_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(bookings);
  } catch (error) {
    console.error('Get Pending Bookings Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/bookings/:id/approve — owner approves.
 * HELD -> PENDING_PAYMENT -> BOOKED (strict order preserved inside one
 * transaction); legacy PENDING bookings keep their APPROVED path.
 */
const approveBooking = async (req, res) => {
  try {
    const [[booking]] = await db.execute('SELECT booking_status FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1', [
      Number(req.params.id),
      req.user.tenant_id,
    ]);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (['BOOKED', 'OCCUPIED', 'COMPLETED', 'APPROVED'].includes(booking.booking_status)) {
      return res.json({ message: 'Booking already approved' });
    }

    if (booking.booking_status === 'PENDING') {
      await machine.transitionBooking({
        tenantId: req.user.tenant_id,
        bookingId: Number(req.params.id),
        to: 'APPROVED',
        actorUserId: req.user.id,
      });
      return res.json({ message: 'Booking approved successfully' });
    }

    await machine.approveBooking({
      tenantId: req.user.tenant_id,
      bookingId: Number(req.params.id),
      actorUserId: req.user.id,
    });
    res.json({ message: 'Booking approved successfully' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Approve Booking Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const rejectBooking = async (req, res) => {
  try {
    await machine.transitionBooking({
      tenantId: req.user.tenant_id,
      bookingId: Number(req.params.id),
      to: 'REJECTED',
      actorUserId: req.user.id,
      reason: 'Rejected by operator',
    });
    res.json({ message: 'Booking rejected successfully' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Reject Booking Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Resident move-in: BOOKED -> OCCUPIED (bed occupied, resident active). */
const checkInBooking = async (req, res) => {
  try {
    await machine.transitionBooking({
      tenantId: req.user.tenant_id,
      bookingId: Number(req.params.id),
      to: 'OCCUPIED',
      actorUserId: req.user.id,
    });
    res.json({ message: 'Resident checked in' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Check-in Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createBooking, getMyBookings, getPendingBookings, approveBooking, rejectBooking, checkInBooking };
