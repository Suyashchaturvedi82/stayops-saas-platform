const express = require('express');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const authRoutes = require('../modules/auth/auth.routes');

const router = express.Router();
router.use(tenantMiddleware);
router.use(authRoutes);

module.exports = router;
