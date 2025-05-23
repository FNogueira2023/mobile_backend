const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Check if user has rated a recipe
router.get('/users/:userId/recipes/:recipeId/rated', ratingController.hasUserRated);

// Create a new rating (requires authentication)
router.post('/recipes/:recipeId/ratings', authenticateToken, ratingController.createRating);

// Get all ratings for a recipe
router.get('/recipes/:recipeId/ratings', ratingController.getRecipeRatings);

// Get average rating for a recipe
router.get('/recipes/:recipeId/ratings/average', ratingController.getAverageRating);

module.exports = router; 