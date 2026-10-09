const db = require('../config/db');
const machine = require('../modules/bookings/bookingStateMachine');

const checkoutPreview = async (req, res) => {
  const { residentId } = req.params;
  try {
    const [[resident]] = await db.execute(
      `SELECT r.id, r.user_id, r.bed_id, r.booking_id, r.security_deposit, u.email, u.first_name, u.last_name
       FROM residents r JOIN users u ON r.user_id = u.id
       WHERE r.id = ? AND r.tenant_id = ? AND r.resident_status = 'ACTIVE'`,
      [residentId, req.user.tenant_id]
    );
    if (!resident) return res.status(404).json({ message: 'Active resident not found' });
    const [[pendingRent]] = await db.execute(
      `SELECT IFNULL(SUM(amount), 0) AS pendingRent FROM payments
       WHERE tenant_id = ? AND user_id = ? AND payment_for = 'RENT' AND payment_status = 'PENDING'`,
      [req.user.tenant_id, resident.user_id]
    );
    const refundableAmount = Math.max(0, Number(resident.security_deposit || 0) - Number(pendingRent.pendingRent || 0));
    res.json({ resident, pendingRent: pendingRent.pendingRent, refundableAmount });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const confirmCheckout = async (req, res) => {
  const { residentId } = req.params;
  const { actual_move_out_date, damage_deduction = 0, other_charges = 0, notes } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[resident]] = await conn.execute(
      `SELECT id, user_id, bed_id, booking_id, security_deposit FROM residents
       WHERE id = ? AND tenant_id = ? AND resident_status = 'ACTIVE' FOR UPDATE`,
      [residentId, req.user.tenant_id]
    );
    if (!resident) throw new Error('Invalid resident, bed or booking not linked');
    // Strict machine: OCCUPIED (or legacy APPROVED) -> COMPLETED.
    const [bookingRows] = await conn.execute(
      'SELECT booking_status FROM bookings WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [resident.booking_id, req.user.tenant_id]
    );
    if (!bookingRows.length) throw new Error('Booking not found');
    machine.assertTransition(bookingRows[0].booking_status, 'COMPLETED');
    const [[pendingRent]] = await conn.execute(
      `SELECT IFNULL(SUM(amount), 0) AS pendingRent FROM payments
       WHERE tenant_id = ? AND user_id = ? AND payment_for = 'RENT' AND payment_status = 'PENDING'`,
      [req.user.tenant_id, resident.user_id]
    );
    const finalAmount = Math.max(0,
      Number(resident.security_deposit || 0) - Number(pendingRent.pendingRent || 0) - Number(damage_deduction) - Number(other_charges)
    );
    await conn.execute(`UPDATE residents SET resident_status = 'CHECKED_OUT', actual_move_out_date = ?, refundable_amount = ?, final_settlement_date = NOW() WHERE id = ? AND tenant_id = ?`, [actual_move_out_date, finalAmount, residentId, req.user.tenant_id]);
    await conn.execute(`UPDATE beds SET is_available = 1, status = 'AVAILABLE' WHERE id = ? AND tenant_id = ?`, [resident.bed_id, req.user.tenant_id]);
    await conn.execute(`UPDATE bookings SET booking_status = 'COMPLETED' WHERE id = ? AND tenant_id = ?`, [resident.booking_id, req.user.tenant_id]);
    await conn.execute(
      `INSERT INTO payments (tenant_id, user_id, booking_id, payment_for, amount, payment_status, notes, payment_date)
       VALUES (?, ?, ?, 'OTHER', ?, 'VERIFIED', ?, CURDATE())`,
      [req.user.tenant_id, resident.user_id, resident.booking_id, finalAmount, notes || 'Final settlement']
    );
    await conn.commit();
    res.json({ message: 'Checkout completed successfully', finalSettlementAmount: finalAmount });
  } catch (err) {
    await conn.rollback(); console.error(err); res.status(err.statusCode || 400).json({ message: err.message });
  } finally { conn.release(); }
};

const mySettlement = async (req, res) => {
  try {
    const [[row]] = await db.execute(
      `SELECT refundable_amount, final_settlement_date FROM residents
       WHERE tenant_id = ? AND user_id = ? AND resident_status = 'CHECKED_OUT'
       ORDER BY final_settlement_date DESC LIMIT 1`,
      [req.user.tenant_id, req.user.id]
    );
    res.json(row || null);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { checkoutPreview, confirmCheckout, mySettlement };
