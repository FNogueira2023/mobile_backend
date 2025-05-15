const unitConversionModel = require('../models/unitConversionModel');

exports.getUnitConversions = async (req, res, next) => {
  try {
    const conversions = await unitConversionModel.getAllUnitConversions();
    res.json(conversions);
  } catch (err) {
    next(err);
  }
}; 