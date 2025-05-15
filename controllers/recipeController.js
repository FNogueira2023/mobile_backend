const recipeModel = require('../models/recipeModel');

exports.getRecipes = async (req, res, next) => {
  try {
    const recipes = await recipeModel.getAllRecipes();
    res.json(recipes);
  } catch (err) {
    next(err);
  }
}; 