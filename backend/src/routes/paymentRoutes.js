const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// USER
router.post('/', verifyToken, paymentController.createPayment);
router.get('/my', verifyToken, paymentController.getMyPayments);

// ADMIN
router.get('/pending', verifyToken, checkRole('ADMIN'), paymentController.getPendingPayments);
router.put('/:id/verify', verifyToken, checkRole('ADMIN'), paymentController.verifyPayment);
router.put('/:id/reject', verifyToken, checkRole('ADMIN'), paymentController.rejectPayment);

module.exports = router;
