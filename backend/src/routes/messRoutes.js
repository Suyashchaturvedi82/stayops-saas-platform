const express = require('express');
const router = express.Router();
const messController = require('../controllers/messController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

// ADMIN ROUTES
router.post('/plans', verifyToken, checkRole('ADMIN'), messController.createPlan);
router.get('/today', verifyToken, checkRole('ADMIN'), messController.getTodayStats);

// USER + ADMIN ROUTES
router.get('/plans', verifyToken, messController.getPlans);
router.post('/subscribe', verifyToken, messController.subscribeToMess);
router.post('/meal', verifyToken, messController.logMeal);
router.get('/me', verifyToken, messController.getMyMess);

module.exports = router;
