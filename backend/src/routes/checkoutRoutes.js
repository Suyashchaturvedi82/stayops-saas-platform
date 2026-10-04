const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// ADMIN
router.get('/:residentId/preview',
  verifyToken,
  checkRole('ADMIN'),
  checkoutController.checkoutPreview
);

router.post('/:residentId/confirm',
  verifyToken,
  checkRole('ADMIN'),
  checkoutController.confirmCheckout
);

// USER
router.get('/me',
  verifyToken,
  checkoutController.mySettlement
);

module.exports = router;
