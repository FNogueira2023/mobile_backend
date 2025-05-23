const { pool } = require('../config/db');

const ratingController = {
    // Check if user has rated a recipe
    hasUserRated: async (req, res) => {
        const { userId, recipeId } = req.params;

        try {
            const [rating] = await pool.query(
                'SELECT * FROM recipe_ratings WHERE userId = ? AND recipeId = ?',
                [userId, recipeId]
            );

            res.json({
                hasRated: rating.length > 0
            });
        } catch (error) {
            console.error('Error checking user rating:', error);
            res.status(500).json({ message: 'Error checking user rating' });
        }
    },

    // Create a new rating
    createRating: async (req, res) => {
        const { recipeId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.userId; // From JWT token

        try {
            // Check if recipe exists
            const [recipe] = await pool.query('SELECT userId FROM recipes WHERE recipeId = ?', [recipeId]);
            
            if (!recipe.length) {
                return res.status(404).json({ message: 'Recipe not found' });
            }

            // Check if user is trying to rate their own recipe
            if (recipe[0].userId === userId) {
                return res.status(400).json({ message: 'You cannot rate your own recipe' });
            }

            // Check if user has already rated this recipe
            const [existingRating] = await pool.query(
                'SELECT * FROM recipe_ratings WHERE userId = ? AND recipeId = ?',
                [userId, recipeId]
            );

            if (existingRating.length > 0) {
                return res.status(400).json({ message: 'You have already rated this recipe' });
            }

            // Validate rating value
            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({ message: 'Rating must be between 1 and 5' });
            }

            // Insert the new rating
            const [result] = await pool.query(
                'INSERT INTO recipe_ratings (userId, recipeId, rating, comment) VALUES (?, ?, ?, ?)',
                [userId, recipeId, rating, comment || null]
            );

            res.status(201).json({
                message: 'Rating created successfully',
                ratingId: result.insertId
            });

        } catch (error) {
            console.error('Error creating rating:', error);
            res.status(500).json({ message: 'Error creating rating' });
        }
    },

    // Get all ratings for a recipe
    getRecipeRatings: async (req, res) => {
        const { recipeId } = req.params;

        try {
            const [ratings] = await pool.query(
                `SELECT r.*, u.username 
                FROM recipe_ratings r 
                JOIN users u ON r.userId = u.userId 
                WHERE r.recipeId = ? 
                ORDER BY r.createdAt DESC`,
                [recipeId]
            );

            res.json(ratings);
        } catch (error) {
            console.error('Error fetching ratings:', error);
            res.status(500).json({ message: 'Error fetching ratings' });
        }
    },

    // Get average rating for a recipe
    getAverageRating: async (req, res) => {
        const { recipeId } = req.params;

        try {
            const [result] = await pool.query(
                'SELECT AVG(rating) as averageRating, COUNT(*) as totalRatings FROM recipe_ratings WHERE recipeId = ?',
                [recipeId]
            );

            res.json({
                averageRating: result[0].averageRating || 0,
                totalRatings: result[0].totalRatings
            });
        } catch (error) {
            console.error('Error fetching average rating:', error);
            res.status(500).json({ message: 'Error fetching average rating' });
        }
    }
};

module.exports = ratingController; 