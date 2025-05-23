CREATE TABLE IF NOT EXISTS recipe_ratings (
    ratingId INT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL,
    recipeId INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId),
    UNIQUE KEY unique_user_recipe (userId, recipeId)
); 