const recipeModel = require('../models/recipeModel');
const { pool } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'recipes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Get file extension
    const ext = path.extname(file.originalname);
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'recipe-' + uniqueSuffix + ext);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

// Configure multer
exports.upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
}).single('imageUrl');

// Error handling middleware for multer
exports.handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Helper function to normalize ingredient name
const normalizeIngredientName = (name) => {
  return name.toLowerCase().trim();
};

// Helper function to validate unit
const isValidUnit = async (connection, abbreviation) => {
  const [units] = await connection.query('SELECT unitId FROM units WHERE abbreviation = ?', [abbreviation]);
  return units.length > 0 ? units[0].unitId : null;
};

// Helper function to validate amount
const isValidAmount = (amount) => {
  return !isNaN(amount) && amount > 0;
};

// Create a new recipe
exports.createRecipe = async (req, res) => {
  try {
    const {
      userId,
      title,
      description,
      instructions,
      prepTime,
      cookTime,
      servings,
      difficulty,
      isPublic = false,
      ingredients,
      action = 'create' // 'create', 'replace', or 'edit'
    } = req.body;

    // Validate required fields
    if (!title || !description || !instructions || !prepTime || !cookTime || !servings || !difficulty) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    // Check for existing recipe with same name
    const [existingRecipes] = await pool.query(
      'SELECT recipeId FROM recipes WHERE userId = ? AND LOWER(title) = LOWER(?)',
      [userId, title]
    );

    // If recipe exists and no action specified, return with options
    if (existingRecipes.length > 0 && action === 'create') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una receta con este nombre',
        existingRecipeId: existingRecipes[0].recipeId,
        options: {
          replace: 'Reemplazar la receta existente',
          edit: 'Editar la receta existente'
        }
      });
    }

    // Parse and validate ingredients
    let parsedIngredients = [];
    try {
      // If ingredients is a string (from form-data), parse it
      if (typeof ingredients === 'string') {
        parsedIngredients = JSON.parse(ingredients);
      } else if (Array.isArray(ingredients)) {
        parsedIngredients = ingredients;
      }

      // Validate ingredients structure
      if (!Array.isArray(parsedIngredients)) {
        return res.status(400).json({
          success: false,
          message: 'Los ingredientes deben ser un array'
        });
      }

      // Validate each ingredient
      for (let i = 0; i < parsedIngredients.length; i++) {
        const ing = parsedIngredients[i];
        
        // Check for missing fields
        const missingFields = [];
        if (!ing.name) missingFields.push('nombre');
        if (!ing.amount) missingFields.push('cantidad');
        if (!ing.unit) missingFields.push('unidad');

        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            message: `El ingrediente ${i + 1} tiene campos faltantes: ${missingFields.join(', ')}`
          });
        }

        // Validate amount
        if (!isValidAmount(ing.amount)) {
          return res.status(400).json({
            success: false,
            message: `Cantidad inválida para el ingrediente "${ing.name}": debe ser un número positivo`
          });
        }

        // Validate unit format
        if (typeof ing.unit !== 'string' || ing.unit.trim() === '') {
          return res.status(400).json({
            success: false,
            message: `Formato de unidad inválido para el ingrediente "${ing.name}": la unidad debe ser un texto no vacío`
          });
        }
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Formato de ingredientes inválido',
        error: error.message
      });
    }

    // Get the uploaded image path if exists
    const imageUrl = req.file ? `/uploads/recipes/${req.file.filename}` : null;

    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let recipeId;

      if (existingRecipes.length > 0) {
        // If replacing or editing existing recipe
        recipeId = existingRecipes[0].recipeId;

        if (action === 'replace') {
          // Delete existing recipe's ingredients
          await connection.query('DELETE FROM usedIngredients WHERE recipeId = ?', [recipeId]);
          
          // Delete the old image if exists
          const [oldRecipe] = await connection.query('SELECT imageUrl FROM recipes WHERE recipeId = ?', [recipeId]);
          if (oldRecipe[0]?.imageUrl) {
            const oldImagePath = path.join(__dirname, '..', oldRecipe[0].imageUrl);
            try {
              await fs.promises.unlink(oldImagePath);
            } catch (error) {
              console.error('Error deleting old recipe image:', error);
            }
          }
        }

        // Update the recipe
        await connection.query(
          `UPDATE recipes SET 
            title = ?, description = ?, instructions = ?, 
            prepTime = ?, cookTime = ?, servings = ?, 
            difficulty = ?, isPublic = ?, imageUrl = ?,
            updatedAt = NOW()
           WHERE recipeId = ?`,
          [title, description, instructions, prepTime, cookTime, 
           servings, difficulty, isPublic, imageUrl, recipeId]
        );
      } else {
        // Create new recipe
        const [recipeResult] = await connection.query(
          `INSERT INTO recipes (
            userId, title, description, instructions, prepTime, 
            cookTime, servings, difficulty, isPublic, isApproved,
            viewCount, imageUrl, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, 0, ?, NOW(), NOW())`,
          [userId, title, description, instructions, prepTime, 
           cookTime, servings, difficulty, isPublic, imageUrl]
        );
        recipeId = recipeResult.insertId;
      }

      // Process each ingredient
      for (const ing of parsedIngredients) {
        const normalizedName = normalizeIngredientName(ing.name);
        
        // Check if unit is valid and get its ID
        const unitId = await isValidUnit(connection, ing.unit);
        if (!unitId) {
          throw new Error(`Abreviatura de unidad inválida "${ing.unit}" para el ingrediente "${ing.name}". Por favor, use una abreviatura válida.`);
        }

        // Check if ingredient exists
        let [existingIngredients] = await connection.query(
          'SELECT ingredientId FROM ingredients WHERE LOWER(name) = ?',
          [normalizedName]
        );

        let ingredientId;

        if (existingIngredients.length > 0) {
          // Use existing ingredient
          ingredientId = existingIngredients[0].ingredientId;
        } else {
          // Insert new ingredient
          const [newIngredient] = await connection.query(
            'INSERT INTO ingredients (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())',
            [ing.name] // Use original name for display
          );
          ingredientId = newIngredient.insertId;
        }

        // Insert into usedIngredients
        await connection.query(
          `INSERT INTO usedIngredients (
            recipeId, ingredientId, amount, unitId, 
            isOptional, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            recipeId,
            ingredientId,
            ing.amount,
            unitId,
            ing.isOptional || false
          ]
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: action === 'create' ? 'Receta creada exitosamente' : 'Receta actualizada exitosamente',
        recipeId: recipeId
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la receta',
      error: error.message
    });
  }
};

// Get recipe by ID
exports.getRecipeById = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const [recipe] = await pool.query(
      `SELECT r.*, u.nickname as authorName
       FROM recipes r
       JOIN users u ON r.userId = u.userId
       WHERE r.recipeId = ?`,
      [recipeId]
    );

    if (!recipe.length) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Get ingredients
    const [ingredients] = await pool.query(
      `SELECT ri.*, i.name as ingredientName, u.name as unitName
       FROM recipeIngredients ri
       JOIN ingredients i ON ri.ingredientId = i.ingredientId
       JOIN units u ON ri.unitId = u.unitId
       WHERE ri.recipeId = ?`,
      [recipeId]
    );

    res.json({
      success: true,
      recipe: {
        ...recipe[0],
        ingredients
      }
    });

  } catch (error) {
    console.error('Error getting recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recipe',
      error: error.message
    });
  }
};

// Update recipe
exports.updateRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const {
      title,
      description,
      instructions,
      prepTime,
      cookTime,
      servings,
      difficulty,
      isPublic,
      ingredients
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get the uploaded image path if exists
      const imageUrl = req.file ? `/uploads/recipes/${req.file.filename}` : undefined;

      // Build the update query dynamically based on whether there's a new image
      let updateQuery = `UPDATE recipes 
         SET title = ?, description = ?, instructions = ?, 
             prepTime = ?, cookTime = ?, servings = ?, 
             difficulty = ?, isPublic = ?, updatedAt = NOW()`;
      
      let queryParams = [title, description, instructions, prepTime, cookTime, 
                        servings, difficulty, isPublic];

      if (imageUrl) {
        updateQuery += ', imageUrl = ?';
        queryParams.push(imageUrl);
      }

      updateQuery += ' WHERE recipeId = ?';
      queryParams.push(recipeId);

      // Update recipe
      await connection.query(updateQuery, queryParams);

      // Update ingredients
      if (ingredients) {
        // Delete existing ingredients
        await connection.query(
          'DELETE FROM recipeIngredients WHERE recipeId = ?',
          [recipeId]
        );

        // Insert new ingredients
        if (ingredients.length > 0) {
          const ingredientValues = ingredients.map(ing => [
            recipeId,
            ing.ingredientId,
            ing.quantity,
            ing.unitId
          ]);

          await connection.query(
            `INSERT INTO recipeIngredients (recipeId, ingredientId, quantity, unitId)
             VALUES ?`,
            [ingredientValues]
          );
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Recipe updated successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating recipe',
      error: error.message
    });
  }
};

// Delete recipe
exports.deleteRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get the recipe's image URL before deleting
      const [recipe] = await connection.query(
        'SELECT imageUrl FROM recipes WHERE recipeId = ?',
        [recipeId]
      );

      // Delete related records first
      await connection.query('DELETE FROM recipeIngredients WHERE recipeId = ?', [recipeId]);
      
      // Delete the recipe
      await connection.query('DELETE FROM recipes WHERE recipeId = ?', [recipeId]);

      await connection.commit();

      // If there was an image, delete it from the filesystem
      if (recipe[0]?.imageUrl) {
        const imagePath = path.join(__dirname, '..', recipe[0].imageUrl);
        try {
          await fs.promises.unlink(imagePath);
        } catch (error) {
          console.error('Error deleting recipe image:', error);
        }
      }

      res.json({
        success: true,
        message: 'Recipe deleted successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting recipe',
      error: error.message
    });
  }
};

// Get all recipes from a user
exports.getUserRecipes = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all recipes from the user
    const [recipes] = await pool.query(
      `SELECT r.*
       FROM recipes r
       WHERE r.userId = ?
       ORDER BY r.createdAt DESC`,
      [userId]
    );

    // For each recipe, get its ingredients
    for (let recipe of recipes) {
      const [ingredients] = await pool.query(
        `SELECT ui.*, i.name as ingredientName, u.name as unitName, u.abbreviation as unitAbbreviation
         FROM usedIngredients ui
         JOIN ingredients i ON ui.ingredientId = i.ingredientId
         JOIN units u ON ui.unitId = u.unitId
         WHERE ui.recipeId = ?`,
        [recipe.recipeId]
      );
      recipe.ingredients = ingredients;
    }

    res.json({
      success: true,
      recipes: recipes
    });

  } catch (error) {
    console.error('Error getting user recipes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las recetas del usuario',
      error: error.message
    });
  }
};

// module.exports = {
//   createRecipe,
//   getRecipeById,
//   updateRecipe,
//   deleteRecipe,
//   upload
// }; 