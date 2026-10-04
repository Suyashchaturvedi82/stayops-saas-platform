const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');

const router = express.Router();

router.get('/plans', authSaasMiddleware, async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const [rows] = await db.execute('SELECT * FROM mess_plans WHERE tenant_id = ? AND is_active = true ORDER BY id DESC', [tenantId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
