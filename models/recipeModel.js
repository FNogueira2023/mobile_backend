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

  if (filters.typeId) {
    query += ' AND r.typeId = ?';
    params.push(filters.typeId);
  }

  if (filters.includeIngredients && filters.includeIngredients.length > 0) {
    const conditions = filters.includeIngredients.map(() => 'LOWER(i.name) LIKE LOWER(?)');
    query += ' AND ' + conditions.join(' AND ');
    params.push(...filters.includeIngredients.map(ing => `%${ing}%`));
  }

  if (filters.excludeIngredients && filters.excludeIngredients.length > 0) {
    const conditions = filters.excludeIngredients.map(() => 'LOWER(i2.name) NOT LIKE LOWER(?)');
    query += ' AND r.recipeId NOT IN (SELECT recipeId FROM usedIngredients ui2 JOIN ingredients i2 ON ui2.ingredientId = i2.ingredientId WHERE ' + conditions.join(' AND ') + ')';
    params.push(...filters.excludeIngredients.map(ing => `%${ing}%`));
  }

  query += ' ORDER BY r.createdAt DESC';

  const [rows] = await pool.query(query, params);
  return rows;
}

async function createRecipe(recipeData) {
  const {
    userId,
    title,
    description,
    instructions,
    prepTime,
    cookTime,
    servings,
    difficulty,
    isPublic,
    typeId,
    imageUrl
  } = recipeData;

  const [result] = await pool.query(
    `INSERT INTO recipes (
      userId, title, description, instructions, prepTime, 
      cookTime, servings, difficulty, isPublic, typeId,
      isApproved, viewCount, imageUrl, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 0, ?, NOW(), NOW())`,
    [userId, title, description, instructions, prepTime, 
     cookTime, servings, difficulty, isPublic, typeId, imageUrl]
  );

  return result.insertId;
}

module.exports = { getAllRecipes, searchRecipes, createRecipe }; 