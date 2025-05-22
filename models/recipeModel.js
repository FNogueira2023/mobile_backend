const { pool } = require('../config/db');

async function getAllRecipes() {
  const [rows] = await pool.query('SELECT * FROM recipes');
  return rows;
}

async function searchRecipes(filters) {
  let query = `
    SELECT DISTINCT r.*, u.nickname as authorName, 
           rt.description as typeDescription
    FROM recipes r
    JOIN users u ON r.userId = u.userId
    LEFT JOIN recipe_types rt ON r.typeId = rt.typeId
    LEFT JOIN usedIngredients ui ON r.recipeId = ui.recipeId
    LEFT JOIN ingredients i ON ui.ingredientId = i.ingredientId
    WHERE 1=1
  `;
  
  const params = [];

  if (filters.name) {
    query += ' AND LOWER(r.title) LIKE LOWER(?)';
    params.push(`%${filters.name}%`);
  }

  if (filters.authorName) {
    query += ' AND LOWER(u.nickname) LIKE LOWER(?)';
    params.push(`%${filters.authorName}%`);
  }

  if (filters.typeId) {
    query += ' AND r.typeId = ?';
    params.push(filters.typeId);
  }

  if (filters.includeIngredients && filters.includeIngredients.length > 0) {
    const conditions = filters.includeIngredients.map(() => 'LOWER(i.name) LIKE LOWER(?)');
    query += ' AND (' + conditions.join(' OR ') + ')';
    params.push(...filters.includeIngredients.map(ing => `%${ing}%`));
  }

  if (filters.excludeIngredients && filters.excludeIngredients.length > 0) {
    query += ' AND NOT EXISTS (';
    query += '   SELECT 1 FROM usedIngredients ui2 ';
    query += '   JOIN ingredients i2 ON ui2.ingredientId = i2.ingredientId ';
    query += '   WHERE ui2.recipeId = r.recipeId AND (';
    const conditions = filters.excludeIngredients.map(() => 'LOWER(i2.name) LIKE LOWER(?)');
    query += conditions.join(' OR ');
    query += '   )';
    query += ' )';
    params.push(...filters.excludeIngredients.map(ing => `%${ing}%`));
  }

  // Add sorting
  const validSortFields = {
    'newest': 'r.createdAt DESC',
    'oldest': 'r.createdAt ASC',
    'name_asc': 'r.title ASC',
    'name_desc': 'r.title DESC'
  };

  const sortField = filters.sort || 'newest';
  query += ` ORDER BY ${validSortFields[sortField] || validSortFields['newest']}`;

  // Add pagination
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 10;
  const offset = (page - 1) * limit;

  // Get total count for pagination
  const countQuery = query.replace('DISTINCT r.*, u.nickname as authorName, rt.description as typeDescription', 'COUNT(DISTINCT r.recipeId) as total');
  const [countResult] = await pool.query(countQuery, params);
  const total = countResult[0].total;

  // Add limit and offset to main query
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  
  return {
    recipes: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function createRecipe(recipeData) {
  const {
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
  } = recipeData;

  console.log('DEBUG - Creating recipe with steps:', JSON.stringify(steps, null, 2));

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Insert recipe
    const [result] = await connection.query(
      `INSERT INTO recipes (
        userId, title, description, prepTime, 
        cookTime, servings, difficulty, isPublic, typeId,
        isApproved, viewCount, imageUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false, 0, ?, NOW(), NOW())`,
      [userId, title, description, prepTime, 
       cookTime, servings, difficulty, isPublic, typeId, imageUrl]
    );

    const recipeId = result.insertId;
    console.log('DEBUG - Recipe created with ID:', recipeId);

    // Insert steps
    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`DEBUG - Processing step ${i}:`, step);

        // Insert step
        const [stepResult] = await connection.query(
          `INSERT INTO step (recipeId, numberStep, text) 
           VALUES (?, ?, ?)`,
          [recipeId, i + 1, step.text]
        );

        const stepId = stepResult.insertId;
        console.log(`DEBUG - Step created with ID: ${stepId}`);

        // If step has photo, insert it
        if (step.photo && step.photo.url) {
          console.log(`DEBUG - Inserting photo for step ${i}:`, step.photo);
          
          // Verify the photo URL is valid and points to the correct directory
          if (step.photo.url.startsWith('/uploads/steps/')) {
            try {
              const [photoResult] = await connection.query(
                `INSERT INTO photo (idStep, extension, url) 
                 VALUES (?, ?, ?)`,
                [stepId, step.photo.extension, step.photo.url]
              );
              console.log(`DEBUG - Photo inserted successfully for step ${i} with URL: ${step.photo.url}`);
              console.log('DEBUG - Photo insert result:', photoResult);
            } catch (error) {
              console.error(`DEBUG - Error inserting photo for step ${i}:`, error);
              throw error;
            }
          } else {
            console.log(`DEBUG - Skipping invalid photo URL for step ${i}: ${step.photo.url}. URL must start with /uploads/steps/`);
          }
        } else {
          console.log(`DEBUG - No photo for step ${i}`);
        }
      }
    }

    await connection.commit();
    return recipeId;
  } catch (error) {
    console.error('DEBUG - Error in createRecipe:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRecipeSteps(recipeId) {
  const [steps] = await pool.query(
    `SELECT s.*, p.extension, p.url as photoUrl
     FROM step s
     LEFT JOIN photo p ON s.idStep = p.idStep
     WHERE s.recipeId = ?
     ORDER BY s.numberStep`,
    [recipeId]
  );
  return steps;
}

module.exports = { 
  getAllRecipes, 
  searchRecipes, 
  createRecipe,
  getRecipeSteps
};