const { pool } = require('../config/db');

async function getAllUnitConversions() {
  const [rows] = await pool.query('SELECT * FROM unitConversions');
  return rows;
}

module.exports = { getAllUnitConversions }; 