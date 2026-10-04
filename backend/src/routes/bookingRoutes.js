const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// User Routes
router.post('/', verifyToken, bookingController.createBooking);
router.get('/my', verifyToken, bookingController.getMyBookings);

// Admin Routes
router.get('/pending', verifyToken, checkRole('ADMIN'), bookingController.getPendingBookings);
router.put('/:id/approve', verifyToken, checkRole('ADMIN'), bookingController.approveBooking);
router.put('/:id/reject', verifyToken, checkRole('ADMIN'), bookingController.rejectBooking);

module.exports = router;