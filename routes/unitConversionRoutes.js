const express = require('express');
const router = express.Router();
const unitConversionController = require('../controllers/unitConversionController');

router.get('/', unitConversionController.getUnitConversions);

module.exports = router; 