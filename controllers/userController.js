const userModel = require('../models/userModel');
const { sendRegistrationEmail, sendPasswordResetEmail } = require('../utils/emailUtils');

exports.getUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// Step 1: Validate email and nickname
exports.validateEmailAndNickname = async (req, res) => {
  try {
    const { email, nickname } = req.body;

    // Basic validation
    if (!email || !nickname) {
      return res.status(400).json({
        success: false,
        message: 'Email and nickname are required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Nickname validation (alphanumeric and underscore only)
    const nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({
        success: false,
        message: 'Nickname can only contain letters, numbers, and underscores'
      });
    }

    const validationResult = await userModel.validateEmailAndNickname(email, nickname);
    
    if (!validationResult.isValid) {
      if (validationResult.isRegistered) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered',
          canResetPassword: validationResult.canResetPassword
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Nickname already exists',
          suggestedNicknames: validationResult.suggestedNicknames
        });
      }
    }

    // Send registration email with code
    await sendRegistrationEmail(email, nickname, validationResult.registrationCode);

    res.status(200).json({
      success: true,
      message: 'Registration code sent to your email',
      codeExpiry: validationResult.codeExpiry
    });
  } catch (error) {
    console.error('Error in validateEmailAndNickname:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Step 2: Complete registration
exports.completeRegistration = async (req, res) => {
  try {
    const { email, nickname, password, registrationCode } = req.body;

    // Validate required fields
    if (!email || !nickname || !password || !registrationCode) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Password validation (minimum 8 characters, at least one number and one letter)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one letter and one number'
      });
    }

    const result = await userModel.completeRegistration({
      email,
      nickname,
      password,
      registrationCode
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      userId: result.userId
    });
  } catch (error) {
    console.error('Error in completeRegistration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const result = await userModel.requestPasswordReset(email);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }

    // Send password reset email
    await sendPasswordResetEmail(email, result.resetCode);

    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
      codeExpiry: result.codeExpiry
    });
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Password validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one letter and one number'
      });
    }

    const result = await userModel.resetPassword(email, resetCode, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 