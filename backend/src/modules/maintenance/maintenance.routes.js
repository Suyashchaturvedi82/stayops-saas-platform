const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');

const router = express.Router();
const OPS_ROLES = ['OWNER', 'MANAGER', 'FRONTDESK'];

router.get('/', authSaasMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const isOps = req.auth.roles.some((role) => OPS_ROLES.includes(role));
    const params = [tenantId];
    let where = 't.tenant_id = ?';

    if (!isOps) {
      where += ' AND t.user_id = ?';
      params.push(req.auth.userId);
    }

    const [rows] = await db.execute(
      `SELECT t.id, t.user_id, t.title, t.category, t.priority, t.status,
              t.description, t.assignee_user_id, t.due_at, t.resolution_note,
              t.created_at, t.updated_at,
              u.email AS reporter_email,
              CONCAT(COALESCE(a.first_name, ''), ' ', COALESCE(a.last_name, '')) AS assignee_name
       FROM maintenance_tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users a ON a.id = t.assignee_user_id
       WHERE ${where}
       ORDER BY FIELD(t.status, 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
                FIELD(t.priority, 'URGENT', 'HIGH', 'MEDIUM', 'LOW'), t.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', authSaasMiddleware, async (req, res, next) => {
  try {
    const { title, category = 'GENERAL', priority = 'MEDIUM', description, due_at } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const [result] = await db.execute(
      `INSERT INTO maintenance_tickets
       (tenant_id, user_id, title, category, priority, status, description, due_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
      [req.tenant.id, req.auth.userId, title.trim(), category, priority, description.trim(), due_at || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Maintenance ticket created.' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authSaasMiddleware, rbacMiddleware(...OPS_ROLES), async (req, res, next) => {
  try {
    const allowed = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    const { status, resolution_note } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid ticket status.' });

    const [result] = await db.execute(
      `UPDATE maintenance_tickets
       SET status = ?, resolution_note = COALESCE(?, resolution_note), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [status, resolution_note || null, Number(req.params.id), req.tenant.id]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Ticket not found.' });
    res.json({ message: `Ticket moved to ${status}.` });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/assign', authSaasMiddleware, rbacMiddleware(...OPS_ROLES), async (req, res, next) => {
  try {
    const assigneeId = req.body.assignee_user_id ? Number(req.body.assignee_user_id) : null;
    const [result] = await db.execute(
      `UPDATE maintenance_tickets
       SET assignee_user_id = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [assigneeId, Number(req.params.id), req.tenant.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Ticket not found.' });
    res.json({ message: assigneeId ? 'Ticket assigned.' : 'Ticket unassigned.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
