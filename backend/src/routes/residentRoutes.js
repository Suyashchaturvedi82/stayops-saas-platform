const express = require('express');
const router = express.Router();
const residentController = require('../controllers/residentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Admin Routes
router.get('/active', verifyToken, checkRole('ADMIN'), residentController.getActiveResidents);
router.put('/:id/checkout', verifyToken, checkRole('ADMIN'), residentController.checkoutResident);

module.exports = router;