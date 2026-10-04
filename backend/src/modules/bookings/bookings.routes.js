const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');

const router = express.Router();

router.get('/', authSaasMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute('SELECT * FROM bookings WHERE tenant_id = ? ORDER BY id DESC', [tenantId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/approve', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'FRONTDESK'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const bookingId = Number(req.params.id);
    await db.execute(
      `UPDATE bookings SET booking_status = 'APPROVED' WHERE id = ? AND tenant_id = ?`,
      [bookingId, tenantId]
    );
    res.json({ message: 'Booking approved' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
