const { pool } = require('../config/db');

// Create student record
async function createStudent(studentData) {
  try {
    const { userId, cardNumber, idFront, idBack, process } = studentData;
    
    const [result] = await pool.query(
      `INSERT INTO students (userId, cardNumber, idFront, idBack, process, accountBalance, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [userId, cardNumber, idFront, idBack, process]
    );

    return {
      success: true,
      studentId: result.insertId
    };
  } catch (error) {
    throw error;
  }
}

// Get student by userId
async function getStudentByUserId(userId) {
  try {
    const [students] = await pool.query(
      'SELECT * FROM students WHERE userId = ?',
      [userId]
    );
    return students[0];
  } catch (error) {
    throw error;
  }
}

// Update student process status
async function updateStudentProcess(studentId, process) {
  try {
    await pool.query(
      'UPDATE students SET process = ?, updatedAt = NOW() WHERE studentId = ?',
      [process, studentId]
    );
    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Update account balance
async function updateAccountBalance(studentId, amount) {
  try {
    await pool.query(
      'UPDATE students SET accountBalance = accountBalance + ?, updatedAt = NOW() WHERE studentId = ?',
      [amount, studentId]
    );
    return { success: true };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createStudent,
  getStudentByUserId,
  updateStudentProcess,
  updateAccountBalance
}; 