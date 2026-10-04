const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, checkRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
    const tenantId = req.tenantId;
    const results = await Promise.all([
      db.execute('SELECT COUNT(*) AS totalRooms FROM rooms WHERE tenant_id = ?', [tenantId]),
      db.execute('SELECT COUNT(*) AS totalBeds FROM beds WHERE tenant_id = ?', [tenantId]),
      db.execute('SELECT COUNT(*) AS availableBeds FROM beds WHERE tenant_id = ? AND is_available = 1', [tenantId]),
      db.execute('SELECT COUNT(*) AS occupiedBeds FROM beds WHERE tenant_id = ? AND is_available = 0', [tenantId]),
      db.execute("SELECT COUNT(*) AS activeResidents FROM residents WHERE tenant_id = ? AND resident_status = 'ACTIVE'", [tenantId]),
      db.execute("SELECT COUNT(*) AS activeMessSubscribers FROM mess_subscriptions WHERE tenant_id = ? AND subscription_status = 'ACTIVE'", [tenantId]),
      db.execute('SELECT COUNT(*) AS todayMealsCount FROM mess_daily_logs WHERE tenant_id = ? AND meal_date = CURDATE()', [tenantId]),
      db.execute("SELECT COUNT(*) AS pendingPayments FROM payments WHERE tenant_id = ? AND payment_status = 'PENDING'", [tenantId]),
      db.execute("SELECT IFNULL(SUM(amount), 0) AS totalVerifiedRevenue FROM payments WHERE tenant_id = ? AND payment_status = 'VERIFIED'", [tenantId]),
      db.execute("SELECT COUNT(*) AS openTickets FROM maintenance_tickets WHERE tenant_id = ? AND status IN ('OPEN','IN_PROGRESS')", [tenantId]),
      db.execute("SELECT COUNT(*) AS criticalTickets FROM maintenance_tickets WHERE tenant_id = ? AND status IN ('OPEN','IN_PROGRESS') AND priority IN ('URGENT','HIGH')", [tenantId]),
    ]);

    const value = (idx, key) => Number(results[idx][0][0][key] || 0);
    const totalBeds = value(1, 'totalBeds');
    const occupiedBeds = value(3, 'occupiedBeds');

    res.json({
      totalRooms: value(0, 'totalRooms'),
      totalBeds,
      availableBeds: value(2, 'availableBeds'),
      occupiedBeds,
      activeResidents: value(4, 'activeResidents'),
      activeMessSubscribers: value(5, 'activeMessSubscribers'),
      todayMealsCount: value(6, 'todayMealsCount'),
      pendingPayments: value(7, 'pendingPayments'),
      totalVerifiedRevenue: value(8, 'totalVerifiedRevenue'),
      openTickets: value(9, 'openTickets'),
      criticalTickets: value(10, 'criticalTickets'),
      occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
