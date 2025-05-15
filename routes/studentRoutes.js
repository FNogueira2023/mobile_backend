const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Upgrade to student account
router.post('/upgrade', studentController.upgradeToStudent);

// Get student status
router.get('/status/:userId', studentController.getStudentStatus);

// Update student process status (admin only)
router.patch('/:studentId/process', studentController.updateProcessStatus);

// Update account balance
router.patch('/:studentId/balance', studentController.updateBalance);

module.exports = router; 