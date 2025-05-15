const usedIngredientModel = require('../models/usedIngredientModel');

exports.getUsedIngredients = async (req, res, next) => {
  try {
    const usedIngredients = await usedIngredientModel.getAllUsedIngredients();
    res.json(usedIngredients);
  } catch (err) {
    next(err);
  }
}; 