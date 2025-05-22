const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// User login
router.post('/login', userController.login);

//Step 0: Validate nickname
router.post('/check-nickname', userController.checkNickname);

// Step 1: Validate email and nickname
router.post('/validate', userController.validateEmailAndNickname);

// Step 2: Complete registration
router.post('/register', userController.completeRegistration);

// Password reset
router.post('/reset-password/request', userController.requestPasswordReset);
router.post('/reset-password/complete', userController.resetPassword);

// Get user by ID
router.get('/:userId', userController.getUserById);

module.exports = router; 