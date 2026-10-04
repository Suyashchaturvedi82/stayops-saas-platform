const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const bedController = require('../controllers/bedController'); // Import bed controller for nested route
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Public (Authenticated) Routes
router.get('/', verifyToken, roomController.getAllRooms);
router.get('/:roomId/beds', verifyToken, bedController.getBedsByRoom);

// Admin Only Routes
router.post('/', verifyToken, checkRole('ADMIN'), roomController.createRoom);
router.put('/:id', verifyToken, checkRole('ADMIN'), roomController.updateRoom);

module.exports = router;