const db = require('../config/db');

const createPlan = async (req, res) => {
  const { plan_name, plan_type, meals_per_day, price_per_month, price_per_meal } = req.body;
  const tenantId = req.user.tenant_id;
  if (!tenantId) return res.status(400).json({ message: 'Tenant context missing.' });
  if (!plan_name || !plan_type) return res.status(400).json({ message: 'Plan name and type are required' });
  try {
    const [result] = await db.execute(
      `INSERT INTO mess_plans (tenant_id, plan_name, plan_type, meals_per_day, price_per_month, price_per_meal, is_active)
       VALUES (?, ?, ?, ?, ?, ?, true)`,
      [tenantId, plan_name, plan_type, meals_per_day || null, price_per_month || null, price_per_meal || null]
    );
    res.status(201).json({ message: 'Mess plan created successfully', planId: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const getPlans = async (req, res) => {
  try {
    const [plans] = await db.execute('SELECT * FROM mess_plans WHERE tenant_id = ? AND is_active = true ORDER BY id DESC', [req.user.tenant_id]);
    res.json(plans);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const getTodayStats = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT meal_type, COUNT(*) AS count FROM mess_daily_logs WHERE tenant_id = ? AND meal_date = CURDATE() GROUP BY meal_type`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

const subscribeToMess = async (req, res) => {
  const { mess_plan_id } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;
  if (!mess_plan_id) return res.status(400).json({ message: 'Mess plan ID required' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute(`SELECT id FROM mess_subscriptions WHERE tenant_id = ? AND user_id = ? AND subscription_status = 'ACTIVE'`, [tenantId, userId]);
    if (existing.length) throw new Error('Already subscribed');
    const [plan] = await conn.execute(`SELECT * FROM mess_plans WHERE id = ? AND tenant_id = ? AND is_active = true`, [mess_plan_id, tenantId]);
    if (!plan.length) throw new Error('Invalid mess plan');
    const [booking] = await conn.execute(`SELECT id FROM bookings WHERE user_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1`, [userId, tenantId]);
    if (!booking.length) throw new Error('Please create a room booking first.');
    const selectedPlan = plan[0];
    const totalAmount = selectedPlan.plan_type === 'PAY_PER_MEAL' ? 0 : Number(selectedPlan.price_per_month || 0);
    await conn.execute(
      `INSERT INTO mess_subscriptions (tenant_id, user_id, mess_plan_id, booking_id, start_date, end_date, subscription_status, total_amount, paid_amount, payment_status)
       VALUES (?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'ACTIVE', ?, 0, 'PENDING')`,
      [tenantId, userId, mess_plan_id, booking[0].id, totalAmount]
    );
    await conn.commit();
    res.json({ message: selectedPlan.plan_type === 'PAY_PER_MEAL' ? 'Pay-per-meal plan activated' : 'Mess subscription activated' });
  } catch (err) {
    await conn.rollback(); res.status(400).json({ message: err.message });
  } finally { conn.release(); }
};

const logMeal = async (req, res) => {
  const { meal_type } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;
  if (!meal_type) return res.status(400).json({ message: 'Meal type required' });
  try {
    const [booking] = await db.execute(`SELECT id FROM bookings WHERE user_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1`, [userId, tenantId]);
    const bookingId = booking.length ? booking[0].id : null;
    const [sub] = await db.execute(
      `SELECT ms.mess_plan_id, mp.price_per_meal
       FROM mess_subscriptions ms JOIN mess_plans mp ON ms.mess_plan_id = mp.id
       WHERE ms.tenant_id = ? AND ms.user_id = ? AND ms.subscription_status = 'ACTIVE' AND mp.plan_type = 'PAY_PER_MEAL' LIMIT 1`,
      [tenantId, userId]
    );
    if (!sub.length) return res.status(403).json({ message: 'No active PAY_PER_MEAL plan found' });
    await db.execute(
      `INSERT INTO mess_daily_logs (tenant_id, user_id, meal_date, meal_type, mess_plan_id, booking_id, meal_price)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?)`,
      [tenantId, userId, meal_type, sub[0].mess_plan_id, bookingId, sub[0].price_per_meal]
    );
    res.json({ message: 'Meal logged successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Meal already logged for this type today' });
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

const getMyMess = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT ms.*, mp.plan_name, mp.plan_type FROM mess_subscriptions ms
       JOIN mess_plans mp ON ms.mess_plan_id = mp.id
       WHERE ms.tenant_id = ? AND ms.user_id = ? AND ms.subscription_status = 'ACTIVE'
       ORDER BY ms.id DESC LIMIT 1`,
      [req.user.tenant_id, req.user.id]
    );
    res.json({ activeSubscription: rows.length ? rows[0] : null });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { createPlan, getPlans, getTodayStats, subscribeToMess, logMeal, getMyMess };
