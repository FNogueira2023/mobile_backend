const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Step 1: Validate email and nickname
router.post('/validate', userController.validateEmailAndNickname);

// Step 2: Complete registration
router.post('/register', userController.completeRegistration);

// Password reset
router.post('/reset-password/request', userController.requestPasswordReset);
router.post('/reset-password/complete', userController.resetPassword);

module.exports = router; 