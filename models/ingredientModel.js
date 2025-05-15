const { pool } = require('../config/db');

async function getAllIngredients() {
  const [rows] = await pool.query('SELECT * FROM ingredients');
  return rows;
}

module.exports = { getAllIngredients }; 