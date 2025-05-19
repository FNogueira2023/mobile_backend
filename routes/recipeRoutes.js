const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Search recipes
router.get('/search', recipeController.searchRecipes);

// Create a new recipe (requires authentication)
router.post('/', 
  authenticateToken, 
  recipeController.upload,
  recipeController.handleMulterError,
  recipeController.createRecipe
);

// Get all recipes from a user
router.get('/user/:userId', recipeController.getUserRecipes);

// Get recipe by ID
router.get('/:recipeId', recipeController.getRecipeById);

// Update recipe (requires authentication)
router.put('/:recipeId', 
  authenticateToken, 
  recipeController.upload,
  recipeController.handleMulterError,
  recipeController.updateRecipe
);

// Delete recipe (requires authentication)
router.delete('/:recipeId', authenticateToken, recipeController.deleteRecipe);

module.exports = router; 