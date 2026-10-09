const db = require('../config/db');
const machine = require('../modules/bookings/bookingStateMachine');

const createPayment = async (req, res) => {
  const { booking_id, payment_for, amount, upi_transaction_id, payment_screenshot_url } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing' });
  if (!payment_for || !amount || !payment_screenshot_url) return res.status(400).json({ message: 'Required payment details missing' });
  try {
    if (booking_id) {
      const [booking] = await db.execute('SELECT id, booking_status FROM bookings WHERE id = ? AND user_id = ? AND tenant_id = ?', [booking_id, userId, tenantId]);
      if (!booking.length) return res.status(400).json({ message: 'Booking does not belong to your workspace/account.' });
    }
    await db.execute(
      `INSERT INTO payments (tenant_id, user_id, booking_id, payment_for, amount, payment_date, payment_status, upi_transaction_id, payment_screenshot_url)
       VALUES (?, ?, ?, ?, ?, CURDATE(), 'PENDING', ?, ?)`,
      [tenantId, userId, booking_id || null, payment_for, amount, upi_transaction_id || null, payment_screenshot_url]
    );

    // State machine: paying for a HELD bed moves it to PENDING_PAYMENT.
    if (booking_id && booking[0].booking_status === 'HELD') {
      try {
        await machine.transitionBooking({ tenantId, bookingId: booking_id, to: 'PENDING_PAYMENT', actorUserId: userId });
      } catch (transitionErr) {
        // Payment row is already recorded; a lost race on the booking
        // (e.g. hold just expired) must not fail the payment upload.
        console.error('booking transition after payment failed:', transitionErr.message);
      }
    }

    res.status(201).json({ message: 'Payment submitted for verification' });
  } catch (err) { console.error('PAYMENT CREATE ERROR:', err); res.status(500).json({ message: 'Server error' }); }
};

const getPendingPayments = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.email FROM payments p JOIN users u ON p.user_id = u.id
       WHERE p.tenant_id = ? AND p.payment_status = 'PENDING' ORDER BY p.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const verifyPayment = async (req, res) => {
  try {
    const [result] = await db.execute(
      `UPDATE payments SET payment_status = 'VERIFIED', admin_verified_by = ?, admin_verified_at = NOW()
       WHERE id = ? AND tenant_id = ? AND payment_status = 'PENDING'`,
      [req.user.id, req.params.id, req.user.tenant_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Payment not found or already processed' });
    res.json({ message: 'Payment verified successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const rejectPayment = async (req, res) => {
  const { reason } = req.body;
  try {
    const [result] = await db.execute(
      `UPDATE payments SET payment_status = 'REJECTED', admin_verified_by = ?, admin_verified_at = NOW(), admin_rejection_reason = ?
       WHERE id = ? AND tenant_id = ? AND payment_status = 'PENDING'`,
      [req.user.id, reason || 'Invalid payment', req.params.id, req.user.tenant_id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Payment not found or already processed' });
    res.json({ message: 'Payment rejected' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const getMyPayments = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM payments WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC`,
      [req.user.tenant_id, req.user.id]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { createPayment, getPendingPayments, verifyPayment, rejectPayment, getMyPayments };
