const db = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    // Rooms
    const [[{ totalRooms }]] = await db.execute(
      'SELECT COUNT(*) AS totalRooms FROM rooms'
    );

    // Beds
    const [[{ totalBeds }]] = await db.execute(
      'SELECT COUNT(*) AS totalBeds FROM beds'
    );

    const [[{ availableBeds }]] = await db.execute(
      'SELECT COUNT(*) AS availableBeds FROM beds WHERE is_available = 1'
    );

    const [[{ occupiedBeds }]] = await db.execute(
      'SELECT COUNT(*) AS occupiedBeds FROM beds WHERE is_available = 0'
    );

    // Residents
    const [[{ activeResidents }]] = await db.execute(
      'SELECT COUNT(*) AS activeResidents FROM residents'
    );

    // Mess
    const [[{ activeMessSubscribers }]] = await db.execute(
      `SELECT COUNT(*) AS activeMessSubscribers
       FROM mess_subscriptions
       WHERE subscription_status = 'ACTIVE'`
    );

    const [[{ todayMealsCount }]] = await db.execute(
      `SELECT COUNT(*) AS todayMealsCount
       FROM mess_daily_logs
       WHERE meal_date = CURDATE()`
    );

    // Payments
    const [[{ pendingPayments }]] = await db.execute(
      `SELECT COUNT(*) AS pendingPayments
       FROM payments
       WHERE payment_status = 'PENDING'`
    );

    const [[{ totalVerifiedRevenue }]] = await db.execute(
      `SELECT IFNULL(SUM(amount), 0) AS totalVerifiedRevenue
       FROM payments
       WHERE payment_status = 'VERIFIED'`
    );

    return res.json({
      totalRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
      activeResidents,
      activeMessSubscribers,
      todayMealsCount,
      pendingPayments,
      totalVerifiedRevenue
    });

  } catch (err) {
    console.error('DASHBOARD ERROR:', err);
    return res.status(500).json({
      message: 'Server error',
      sqlMessage: err.sqlMessage,
      code: err.code
    });
  }
};

module.exports = { getDashboardStats };
