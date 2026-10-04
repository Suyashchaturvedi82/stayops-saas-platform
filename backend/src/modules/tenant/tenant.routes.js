const express = require('express');
const controller = require('./tenant.controller');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');

const router = express.Router();

router.post('/', authSaasMiddleware, rbacMiddleware('OWNER'), controller.createTenant);
router.get('/', authSaasMiddleware, rbacMiddleware('OWNER'), controller.listTenants);

module.exports = router;
