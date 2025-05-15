const unitModel = require('../models/unitModel');

exports.getUnits = async (req, res, next) => {
  try {
    const units = await unitModel.getAllUnits();
    res.json(units);
  } catch (err) {
    next(err);
  }
}; 