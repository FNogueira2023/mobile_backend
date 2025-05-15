const userModel = require('../models/userModel');
const { sendEmail } = require('../utils/emailUtils');

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
        message: 'Email y nickname son requeridos'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }

    // Nickname validation
    const nicknameRegex = /^[a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({
        success: false,
        message: 'Nickname solo puede contener letras, números y guiones bajos'
      });
    }

    const validationResult = await userModel.validateEmailAndNickname(email, nickname);
    
    if (!validationResult.isValid) {
      if (validationResult.isRegistered) {
        return res.status(400).json({
          success: false,
          message: 'Email ya registrado',
          canResetPassword: validationResult.canResetPassword
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Nickname ya existe',
          suggestedNicknames: validationResult.suggestedNicknames
        });
      }
    }

    // Send registration email
    const emailSubject = 'Tu código de registración';
    const emailHtml = `
      <h2>Bienvenido a LamaCooking!</h2>
      <p>Tu código de registración es: <strong>${validationResult.registrationCode}</strong></p>
      <p>El código va a expirar en: ${validationResult.codeExpiry}</p>
    `;
    
    await sendEmail(email, emailSubject, emailHtml);

    res.status(200).json({
      success: true,
      message: 'Código de registración enviado a tu correo',
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

    // Password validation
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

    // Send welcome email
    const welcomeSubject = 'Welcome to Our Platform!';
    const welcomeHtml = `
      <h2>Welcome aboard, ${nickname}!</h2>
      <p>Your account has been successfully created.</p>
      <p>Thank you for joining our community!</p>
    `;
    await sendEmail(email, welcomeSubject, welcomeHtml);

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
    const resetSubject = 'Password Reset Request';
    const resetHtml = `
      <h2>Password Reset</h2>
      <p>Your password reset code is: <strong>${result.resetCode}</strong></p>
      <p>This code will expire at: ${result.codeExpiry}</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    await sendEmail(email, resetSubject, resetHtml);

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

    // Send password changed confirmation
    const confirmSubject = 'Password Changed Successfully';
    const confirmHtml = `
      <h2>Password Update Confirmation</h2>
      <p>Your password has been successfully updated.</p>
      <p>If you didn't make this change, please contact our support team immediately.</p>
    `;
    await sendEmail(email, confirmSubject, confirmHtml);

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