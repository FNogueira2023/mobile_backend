const ingredientModel = require('../models/ingredientModel');

exports.getIngredients = async (req, res, next) => {
  try {
    const ingredients = await ingredientModel.getAllIngredients();
    res.json(ingredients);
  } catch (err) {
    next(err);
  }
}; 