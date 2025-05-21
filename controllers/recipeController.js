const recipeModel = require('../models/recipeModel');
const { pool } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const recipeUploadDir = path.join(__dirname, '..', 'uploads', 'recipes');
const stepUploadDir = path.join(__dirname, '..', 'uploads', 'steps');

[recipeUploadDir, stepUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine which directory to use based on the field name
    const uploadDir = file.fieldname === 'recipeImage' ? recipeUploadDir : stepUploadDir;
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Get file extension
    const ext = path.extname(file.originalname);
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'recipeImage' ? 'recipe-' : 'step-';
    cb(null, prefix + uniqueSuffix + ext);
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

// Configure multer for multiple file uploads
exports.upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 10 // Maximum 10 files (1 recipe image + 9 step images)
  }
}).fields([
  { name: 'recipeImage', maxCount: 1 },
  { name: 'stepImages', maxCount: 9 }
]);

// Error handling middleware for multer
exports.handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files (1 recipe image + 9 step images)'
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
    let recipeData;
    
    // Intentar parsear los datos de la receta
    try {
      recipeData = JSON.parse(req.body.recipeData);
    } catch (error) {
      // Si no hay recipeData en el body, intentar usar el body directamente
      recipeData = req.body;
    }

    const {
      userId,
      title,
      description,
      steps,
      prepTime,
      cookTime,
      servings,
      difficulty,
      isPublic = false,
      typeId,
      ingredients,
      action = 'create' // Agregamos action con valor por defecto
    } = recipeData;

    // Validate required fields
    if (!title || !description || !steps || !prepTime || !cookTime || !servings || !difficulty || !typeId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos',
        receivedData: recipeData
      });
    }

    // Validate typeId exists
    const [typeExists] = await pool.query('SELECT typeId FROM recipe_types WHERE typeId = ?', [typeId]);
    if (!typeExists.length) {
      return res.status(400).json({
        success: false,
        message: 'El tipo de receta especificado no existe'
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

    // Process uploaded files
    const recipeImage = req.files?.recipeImage?.[0];
    const stepImages = req.files?.stepImages || [];

    // Get the uploaded image path if exists
    const imageUrl = recipeImage ? `/uploads/recipes/${recipeImage.filename}` : null;

    // Match step images with steps
    if (stepImages.length > 0) {
      // Assuming step images are uploaded in order
      stepImages.forEach((file, index) => {
        if (steps[index]) {
          steps[index].photo = {
            extension: path.extname(file.originalname).substring(1),
            url: `/uploads/steps/${file.filename}`
          };
        }
      });
    }

    // Parse and validate ingredients
    let parsedIngredients = [];
    try {
      if (typeof ingredients === 'string') {
        parsedIngredients = JSON.parse(ingredients);
      } else if (Array.isArray(ingredients)) {
        parsedIngredients = ingredients;
      }

      if (!Array.isArray(parsedIngredients)) {
        return res.status(400).json({
          success: false,
          message: 'Los ingredientes deben ser un array'
        });
      }

      for (let i = 0; i < parsedIngredients.length; i++) {
        const ing = parsedIngredients[i];
        
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

        if (!isValidAmount(ing.amount)) {
          return res.status(400).json({
            success: false,
            message: `Cantidad inválida para el ingrediente "${ing.name}": debe ser un número positivo`
          });
        }

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

    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let recipeId;

      if (existingRecipes.length > 0) {
        // If replacing or editing existing recipe
        recipeId = existingRecipes[0].recipeId;

        if (action === 'replace') {
          // Delete existing recipe's ingredients and steps
          await connection.query('DELETE FROM usedIngredients WHERE recipeId = ?', [recipeId]);
          
          // Get existing steps to delete their photos
          const [existingSteps] = await connection.query(
            'SELECT s.idStep, p.url FROM step s LEFT JOIN photo p ON s.idStep = p.idStep WHERE s.recipeId = ?',
            [recipeId]
          );
          
          // Delete steps and their photos
          await connection.query('DELETE FROM step WHERE recipeId = ?', [recipeId]);
          
          // Delete old photos
          for (const step of existingSteps) {
            if (step.url) {
              const photoPath = path.join(__dirname, '..', step.url);
              try {
                await fs.promises.unlink(photoPath);
              } catch (error) {
                console.error('Error deleting old step photo:', error);
              }
            }
          }
          
          // Delete the old recipe image if exists
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
            title = ?, description = ?, 
            prepTime = ?, cookTime = ?, servings = ?, 
            difficulty = ?, isPublic = ?, typeId = ?, imageUrl = ?,
            updatedAt = NOW()
           WHERE recipeId = ?`,
          [title, description, prepTime, cookTime, 
           servings, difficulty, isPublic, typeId, imageUrl, recipeId]
        );
      } else {
        // Create new recipe
        recipeId = await recipeModel.createRecipe({
          userId,
          title,
          description,
          steps,
          prepTime,
          cookTime,
          servings,
          difficulty,
          isPublic,
          typeId,
          imageUrl
        });
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
          ingredientId = existingIngredients[0].ingredientId;
        } else {
          const [newIngredient] = await connection.query(
            'INSERT INTO ingredients (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())',
            [ing.name]
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
      `SELECT ui.*, i.name as ingredientName, u.name as unitName
       FROM usedIngredients ui
       JOIN ingredients i ON ui.ingredientId = i.ingredientId
       JOIN units u ON ui.unitId = u.unitId
       WHERE ui.recipeId = ?`,
      [recipeId]
    );

    // Get steps with photos
    const steps = await recipeModel.getRecipeSteps(recipeId);

    res.json({
      success: true,
      recipe: {
        ...recipe[0],
        ingredients,
        steps
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
      steps,
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
         SET title = ?, description = ?, 
             prepTime = ?, cookTime = ?, servings = ?, 
             difficulty = ?, isPublic = ?, updatedAt = NOW()`;
      
      let queryParams = [title, description, prepTime, cookTime, 
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
          'DELETE FROM usedIngredients WHERE recipeId = ?',
          [recipeId]
        );

        // Insert new ingredients
        if (ingredients.length > 0) {
          for (const ing of ingredients) {
            // Validate required fields
            if (!ing.name || !ing.amount || !ing.unit) {
              throw new Error(`Missing required fields for ingredient: name, amount, and unit are required`);
            }

            // Normalize ingredient name
            const normalizedName = normalizeIngredientName(ing.name);
            
            // Check if unit is valid and get its ID
            const unitId = await isValidUnit(connection, ing.unit);
            if (!unitId) {
              throw new Error(`Invalid unit abbreviation "${ing.unit}" for ingredient "${ing.name}". Please use a valid abbreviation.`);
            }

            // Check if ingredient exists
            let [existingIngredients] = await connection.query(
              'SELECT ingredientId FROM ingredients WHERE LOWER(name) = ?',
              [normalizedName]
            );

            let ingredientId;

            if (existingIngredients.length > 0) {
              ingredientId = existingIngredients[0].ingredientId;
            } else {
              const [newIngredient] = await connection.query(
                'INSERT INTO ingredients (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())',
                [ing.name]
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
      await connection.query('DELETE FROM usedIngredients WHERE recipeId = ?', [recipeId]);
      
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

// Search recipes
exports.searchRecipes = async (req, res) => {
  try {
    const filters = {
      name: req.query.name,
      typeId: req.query.typeId ? parseInt(req.query.typeId) : null,
      includeIngredients: req.query.includeIngredients ? req.query.includeIngredients.split(',') : [],
      excludeIngredients: req.query.excludeIngredients ? req.query.excludeIngredients.split(',') : [],
      authorName: req.query.authorName,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await recipeModel.searchRecipes(filters);

    // For each recipe, get its ingredients
    for (let recipe of result.recipes) {
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
      recipes: result.recipes,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching recipes',
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