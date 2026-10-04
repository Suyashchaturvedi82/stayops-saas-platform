const db = require('../config/db');

const getActiveResidents = async (req, res) => {
  try {
    const [residents] = await db.execute(
      `SELECT res.id, res.resident_status, res.move_in_date, res.expected_move_out_date,
              u.email, r.room_number, bed.bed_number
       FROM residents res
       JOIN users u ON res.user_id = u.id
       JOIN beds bed ON res.bed_id = bed.id
       JOIN rooms r ON bed.room_id = r.id
       WHERE res.tenant_id = ? AND res.resident_status = 'ACTIVE'
       ORDER BY res.move_in_date DESC`,
      [req.user.tenant_id]
    );
    res.json(residents);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' }); }
};

const checkoutResident = async (req, res) => {
  const residentId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [resident] = await connection.execute(
      `SELECT * FROM residents WHERE id = ? AND tenant_id = ? AND resident_status = 'ACTIVE' FOR UPDATE`,
      [residentId, req.user.tenant_id]
    );
    if (!resident.length) throw new Error('Active resident not found');
    const { booking_id, bed_id } = resident[0];
    await connection.execute(`UPDATE residents SET resident_status = 'CHECKED_OUT', actual_move_out_date = CURDATE() WHERE id = ? AND tenant_id = ?`, [residentId, req.user.tenant_id]);
    await connection.execute(`UPDATE beds SET is_available = true WHERE id = ? AND tenant_id = ?`, [bed_id, req.user.tenant_id]);
    await connection.execute(`UPDATE bookings SET booking_status = 'COMPLETED', actual_check_out_date = CURDATE() WHERE id = ? AND tenant_id = ?`, [booking_id, req.user.tenant_id]);
    await connection.commit();
    res.json({ message: 'Resident checked out successfully' });
  } catch (error) {
    await connection.rollback(); console.error(error); res.status(400).json({ message: error.message });
  } finally { connection.release(); }
};

module.exports = { getActiveResidents, checkoutResident };
