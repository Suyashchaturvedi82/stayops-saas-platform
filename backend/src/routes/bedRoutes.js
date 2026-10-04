const express = require('express');
const router = express.Router();
const bedController = require('../controllers/bedController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Admin Only Routes (Creating/Updating specific beds)
router.post('/', verifyToken, checkRole('ADMIN'), bedController.createBed);
router.put('/:id', verifyToken, checkRole('ADMIN'), bedController.updateBed);

module.exports = router;