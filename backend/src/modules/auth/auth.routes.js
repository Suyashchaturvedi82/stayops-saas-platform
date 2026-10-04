const express = require('express');
const controller = require('./auth.controller');
const { registerSchema, loginSchema, refreshSchema } = require('./auth.schemas');
const validateRequest = require('../../middleware/validateRequest');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');

const router = express.Router();

router.post('/register', validateRequest(registerSchema), controller.register);
router.post('/login', validateRequest(loginSchema), controller.login);
// Refresh is deliberately public: an expired access token must not prevent refresh.
router.post('/refresh', validateRequest(refreshSchema), controller.refresh);
router.get('/me', authSaasMiddleware, controller.me);

module.exports = router;
