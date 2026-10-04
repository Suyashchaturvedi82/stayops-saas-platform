const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');

const router = express.Router();

router.get('/occupancy-rate', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [[rooms]] = await db.execute('SELECT COUNT(*) AS count FROM rooms WHERE tenant_id = ?', [tenantId]);
    const [[beds]] = await db.execute('SELECT COUNT(*) AS total, SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END) AS occupied FROM beds WHERE tenant_id = ?', [tenantId]);

    res.json({
      total_rooms: Number(rooms.count || 0),
      total_beds: Number(beds.total || 0),
      occupied_beds: Number(beds.occupied || 0),
      occupancy_rate: Number(beds.total || 0) === 0 ? 0 : Number(((Number(beds.occupied || 0) / Number(beds.total || 1)) * 100).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/arrears-aging', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute(
      `SELECT
         SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN balance_due ELSE 0 END) AS d1_30,
         SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN balance_due ELSE 0 END) AS d31_60,
         SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 60 THEN balance_due ELSE 0 END) AS d60_plus
       FROM invoices
       WHERE tenant_id = ? AND status IN ('ISSUED', 'OVERDUE')`,
      [tenantId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/revenue-kpis', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [[paid]] = await db.execute(
      `SELECT IFNULL(SUM(amount), 0) AS paid_revenue
       FROM payments
       WHERE tenant_id = ? AND payment_status = 'VERIFIED'`,
      [tenantId]
    );
    const [[pending]] = await db.execute(
      `SELECT IFNULL(SUM(balance_due), 0) AS outstanding
       FROM invoices
       WHERE tenant_id = ? AND status IN ('ISSUED', 'OVERDUE')`,
      [tenantId]
    );

    res.json({ paid_revenue: Number(paid.paid_revenue), outstanding: Number(pending.outstanding) });
  } catch (err) {
    next(err);
  }
});

router.get('/churn-risk', authSaasMiddleware, rbacMiddleware('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute(
      `SELECT u.id AS resident_user_id,
              u.email,
              ROUND((
                (CASE WHEN p.pending_count >= 2 THEN 0.5 ELSE 0 END) +
                (CASE WHEN b.pending_booking_count >= 1 THEN 0.2 ELSE 0 END) +
                (CASE WHEN i.overdue_count >= 1 THEN 0.3 ELSE 0 END)
              ), 2) AS risk_score
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS pending_count
         FROM payments
         WHERE tenant_id = ? AND payment_status = 'PENDING'
         GROUP BY user_id
       ) p ON p.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS pending_booking_count
         FROM bookings
         WHERE tenant_id = ? AND booking_status = 'PENDING'
         GROUP BY user_id
       ) b ON b.user_id = u.id
       LEFT JOIN (
         SELECT resident_user_id, COUNT(*) AS overdue_count
         FROM invoices
         WHERE tenant_id = ? AND status = 'OVERDUE'
         GROUP BY resident_user_id
       ) i ON i.resident_user_id = u.id
       ORDER BY risk_score DESC
       LIMIT 50`,
      [tenantId, tenantId, tenantId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
