const express = require('express');

const tenantMiddleware = require('../middleware/tenantMiddleware');
const rateLimitPerTenant = require('../middleware/rateLimitPerTenant');

const authRoutes = require('../modules/auth/auth.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const paymentsRoutes = require('../modules/payments/payments.routes');
const commsRoutes = require('../modules/comms/comms.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const automationRoutes = require('../modules/automation/automation.routes');
const inventoryRoutes = require('../modules/inventory/inventory.routes');
const bookingsRoutes = require('../modules/bookings/bookings.routes');
const messRoutes = require('../modules/mess/mess.routes');

const router = express.Router();

router.use(tenantMiddleware);
router.use(rateLimitPerTenant);

router.use('/auth', authRoutes);
router.use('/billing', billingRoutes);
router.use('/payments', paymentsRoutes);
router.use('/comms', commsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/automations', automationRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/mess', messRoutes);

module.exports = router;
