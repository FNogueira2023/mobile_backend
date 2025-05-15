const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { generateRegistrationCode, generatePasswordResetCode } = require('../utils/emailUtils');


// Step 1: Validate email and nickname
async function validateEmailAndNickname(email, nickname) {
  try {
    // Check if email or nickname already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR nickname = ?',
      [email, nickname]
    );
    
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.email === email) {
        return {
          isValid: false,
          message: 'Email ya existe',
          isRegistered: true,
          canResetPassword: true
        };
      } else {
        // Find similar nicknames
        const [similarNicknames] = await pool.query(
          'SELECT nickname FROM users WHERE nickname LIKE ? LIMIT 5',
          [`${nickname}%`]
        );
        
        return {
          isValid: false,
          message: 'Nickname ya existe',
          isRegistered: false,
          suggestedNicknames: similarNicknames.map(n => n.nickname)
        };
      }
    }

    // Generate registration code
    const registrationCode = generateRegistrationCode();
    const codeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store temporary registration
    await pool.query(
      `INSERT INTO temp_registrations (email, nickname, registrationCode, codeExpiry) 
       VALUES (?, ?, ?, ?)`,
      [email, nickname, registrationCode, codeExpiry]
    );

    return {
      isValid: true,
      registrationCode,
      codeExpiry
    };
  } catch (error) {
    throw error;
  }
}

// Step 2: Complete registration
async function completeRegistration(userData) {
  try {
    const { email, nickname, password, registrationCode } = userData;
    
    // Verify registration code
    const [tempReg] = await pool.query(
      'SELECT * FROM temp_registrations WHERE email = ? AND registrationCode = ? AND codeExpiry > NOW()',
      [email, registrationCode]
    );

    if (!tempReg.length) {
      return {
        success: false,
        message: 'Invalid or expired registration code'
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert new user
    const [result] = await pool.query(
      `INSERT INTO users (email, nickname, passwordHash, enabled, createdAt, updatedAt) 
       VALUES (?, ?, ?, true, NOW(), NOW())`,
      [email, nickname, passwordHash]
    );

    // Delete temporary registration
    await pool.query('DELETE FROM temp_registrations WHERE email = ?', [email]);

    return {
      success: true,
      userId: result.insertId
    };
  } catch (error) {
    throw error;
  }
}

// Request password reset
async function requestPasswordReset(email) {
  try {
    const [user] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user.length) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const resetCode = generatePasswordResetCode();
    const codeExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await pool.query(
      `INSERT INTO password_resets (email, resetCode, codeExpiry) 
       VALUES (?, ?, ?)`,
      [email, resetCode, codeExpiry]
    );

    return {
      success: true,
      resetCode,
      codeExpiry
    };
  } catch (error) {
    throw error;
  }
}

// Reset password
async function resetPassword(email, resetCode, newPassword) {
  try {
    const [reset] = await pool.query(
      'SELECT * FROM password_resets WHERE email = ? AND resetCode = ? AND codeExpiry > NOW()',
      [email, resetCode]
    );

    if (!reset.length) {
      return {
        success: false,
        message: 'Invalid or expired reset code'
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET passwordHash = ?, updatedAt = NOW() WHERE email = ?',
      [passwordHash, email]
    );

    // Delete used reset code
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

    return {
      success: true
    };
  } catch (error) {
    throw error;
  }
}

// Get user by email
async function getUserByEmail(email) {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return users[0];
  } catch (error) {
    throw error;
  }
}

module.exports = {
  validateEmailAndNickname,
  completeRegistration,
  requestPasswordReset,
  resetPassword,
  getUserByEmail
}; 