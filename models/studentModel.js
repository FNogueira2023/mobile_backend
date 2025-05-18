const { pool } = require('../config/db');

// Create student record
async function createStudent(studentData) {
  try {
    const { userId, cardNumber, idFront, idBack, process = 'pending' } = studentData;
    
    // Verificar si el usuario ya es estudiante
    const [existing] = await pool.query(
      'SELECT studentId FROM students WHERE userId = ?',
      [userId]
    );
    
    if (existing.length > 0) {
      const error = new Error('El usuario ya es estudiante');
      error.code = 'DUPLICATE_STUDENT';
      throw error;
    }
    
    const [result] = await pool.query(
      `INSERT INTO students 
       (userId, cardNumber, idFront, idBack, process, accountBalance, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [userId, cardNumber, idFront, idBack, process]
    );

    return {
      success: true,
      studentId: result.insertId
    };
  } catch (error) {
    console.error('Error en createStudent:', error);
    throw error;
  }
}

// Get student by userId
async function getStudentByUserId(userId) {
  try {
    const [students] = await pool.query(
      `SELECT s.*, u.email, u.nickname 
       FROM students s
       JOIN users u ON s.userId = u.userId
       WHERE s.userId = ?`,
      [userId]
    );
    return students[0] || null;
  } catch (error) {
    console.error('Error en getStudentByUserId:', error);
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

// Get user by userId (alias for getStudentByUserId for backward compatibility)
async function getUserById(userId) {
  return getStudentByUserId(userId);
}

// Get all students (for admin)
async function getAllStudents() {
  try {
    const [students] = await pool.query(
      `SELECT s.*, u.email, u.nickname, u.createdAt as userCreatedAt
       FROM students s
       JOIN users u ON s.userId = u.userId
       ORDER BY s.createdAt DESC`
    );
    return students;
  } catch (error) {
    console.error('Error en getAllStudents:', error);
    throw error;
  }
}

module.exports = {
  createStudent,
  getStudentByUserId,
  updateStudentProcess,
  updateAccountBalance,
  getUserById
}; 