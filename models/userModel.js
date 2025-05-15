const { pool } = require('../config/db');

async function getAllUsers() {
  const [rows] = await pool.query('SELECT * FROM users');
  return rows;
}

module.exports = { getAllUsers }; 