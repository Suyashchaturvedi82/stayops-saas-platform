const express = require('express');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const authRoutes = require('../modules/auth/auth.routes');

const router = express.Router();
// Pre-auth workspace context only (optional). Authenticated requests must
// derive tenant_id from the JWT — see authSaasMiddleware.
router.use(tenantMiddleware);
router.use(authRoutes);

module.exports = router;
