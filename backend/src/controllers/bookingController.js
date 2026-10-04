const db = require('../config/db');

const createBooking = async (req, res) => {
  const { bed_id, check_in_date, expected_check_out_date, special_requests } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
  if (!bed_id || !check_in_date) return res.status(400).json({ message: 'Bed ID and check-in date are required' });

  try {
    const [existing] = await db.execute(
      `SELECT id FROM bookings WHERE tenant_id = ? AND user_id = ? AND booking_status IN ('PENDING', 'APPROVED')`,
      [tenantId, userId]
    );
    if (existing.length) return res.status(400).json({ message: 'User already has an active booking' });

    const [bed] = await db.execute('SELECT is_available FROM beds WHERE id = ? AND tenant_id = ?', [bed_id, tenantId]);
    if (!bed.length) return res.status(404).json({ message: 'Bed not found' });
    if (!bed[0].is_available) return res.status(400).json({ message: 'Bed is not available' });

    const [result] = await db.execute(
      `INSERT INTO bookings (tenant_id, user_id, bed_id, check_in_date, expected_check_out_date, booking_status, special_requests)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [tenantId, userId, bed_id, check_in_date, expected_check_out_date || null, special_requests || null]
    );
    res.status(201).json({ message: 'Booking created successfully', bookingId: result.insertId, status: 'PENDING' });
  } catch (error) {
    console.error('Create Booking Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const [bookings] = await db.execute(
      `SELECT b.id, b.booking_status, b.check_in_date, b.expected_check_out_date,
              b.total_rent, r.room_number, bed.bed_number
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

const getPendingBookings = async (req, res) => {
  try {
    const [bookings] = await db.execute(
      `SELECT b.id, b.check_in_date, b.booking_status, u.email,
              r.room_number, bed.bed_number
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN beds bed ON b.bed_id = bed.id
       JOIN rooms r ON bed.room_id = r.id
       WHERE b.booking_status = 'PENDING' AND b.tenant_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(bookings);
  } catch (error) {
    console.error('Get Pending Bookings Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const approveBooking = async (req, res) => {
  const bookingId = Number(req.params.id);
  const tenantId = req.user.tenant_id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [booking] = await connection.execute(
      `SELECT * FROM bookings WHERE id = ? AND tenant_id = ? FOR UPDATE`,
      [bookingId, tenantId]
    );
    if (!booking.length) throw new Error('Booking not found');
    if (booking[0].booking_status !== 'PENDING') throw new Error('Booking is not pending');

    const { user_id, bed_id, check_in_date, expected_check_out_date } = booking[0];
    const [bed] = await connection.execute('SELECT is_available FROM beds WHERE id = ? AND tenant_id = ? FOR UPDATE', [bed_id, tenantId]);
    if (!bed.length || !bed[0].is_available) throw new Error('Bed is no longer available');

    await connection.execute(`UPDATE bookings SET booking_status = 'APPROVED', admin_approved_by = ?, admin_approved_at = NOW() WHERE id = ? AND tenant_id = ?`, [req.user.id, bookingId, tenantId]);
    await connection.execute(`UPDATE beds SET is_available = false WHERE id = ? AND tenant_id = ?`, [bed_id, tenantId]);
    await connection.execute(
      `INSERT INTO residents (tenant_id, booking_id, user_id, bed_id, move_in_date, expected_move_out_date, resident_status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [tenantId, bookingId, user_id, bed_id, check_in_date, expected_check_out_date]
    );

    await connection.commit();
    res.json({ message: 'Booking approved successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Approve Booking Error:', error);
    res.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
};

const rejectBooking = async (req, res) => {
  try {
    const [result] = await db.execute(
      `UPDATE bookings SET booking_status = 'REJECTED' WHERE id = ? AND tenant_id = ? AND booking_status = 'PENDING'`,
      [Number(req.params.id), req.user.tenant_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Booking not found or not pending' });
    res.json({ message: 'Booking rejected successfully' });
  } catch (error) {
    console.error('Reject Booking Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createBooking, getMyBookings, getPendingBookings, approveBooking, rejectBooking };
