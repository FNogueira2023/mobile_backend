const { pool } = require('../config/db');

async function getAllRecipes() {
  const [rows] = await pool.query('SELECT * FROM recipes');
  return rows;
}

module.exports = { getAllRecipes }; 