const { pool } = require('../config/db');

async function getAllUsedIngredients() {
  const [rows] = await pool.query('SELECT * FROM usedIngredients');
  return rows;
}

module.exports = { getAllUsedIngredients };

 