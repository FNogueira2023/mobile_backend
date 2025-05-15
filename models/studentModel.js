const { pool } = require('../config/db');

async function getAllStudents() {
  const [rows] = await pool.query('SELECT * FROM students');
  return rows;
}

module.exports = { getAllStudents }; 