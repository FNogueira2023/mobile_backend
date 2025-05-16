const userModel = require('../models/userModel');
const { sendEmail } = require('../utils/emailUtils');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// User login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Find user by email
    const user = await userModel.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Check if user is enabled
    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        message: 'Esta cuenta ha sido deshabilitada. Por favor contacte al soporte.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
        fullName: user.fullName
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Return user data (excluding sensitive info) and token
    const userData = {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname,
      fullName: user.fullName,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};



//Step 0 : Validate nickname
exports.checkNickname = async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) {
      return res.status(400).json({ available: false, message: 'Nickname requerido' });
    }

    // Busca si el nickname ya existe
    const user = await userModel.getUserByNickname(nickname);
    if (!user) {
      return res.status(200).json({ available: true });
    }

    // Sugerencias de nicknames similares
    const [similar] = await require('../config/db').pool.query(
      'SELECT nickname FROM users WHERE nickname LIKE ? LIMIT 5',
      [`${nickname}%`]
    );
    const suggestions = similar.map(u => u.nickname).filter(n => n !== nickname);

    return res.status(200).json({
      available: false,
      suggestions
    });
  } catch (error) {
    console.error('Error in nickname:', error);
    res.status(500).json({ available: false, message: 'Internal server error' });
  }
};



// Step 1: Validate email and nickname
exports.validateEmailAndNickname = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Headers:', req.headers);
    
    if (!req.body) {
      console.error('No request body received');
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }
    
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
    const { fullName, password, registrationCode } = req.body;

    // Validate required fields
    if (!fullName || !password || !registrationCode) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos: nombre completo, contraseña y código de registro'
      });
    }

    // Password validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres y contener al menos una letra y un número'
      });
    }

    // Get the temporary registration data using the registration code
    const [tempReg] = await require('../config/db').pool.query(
      'SELECT * FROM temp_registrations WHERE registrationCode = ? AND codeExpiry > NOW()',
      [registrationCode]
    );

    if (!tempReg.length) {
      return res.status(400).json({
        success: false,
        message: 'Código de registro inválido o expirado'
      });
    }

    const { email, nickname } = tempReg[0];

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert new user
    const [result] = await require('../config/db').pool.query(
      `INSERT INTO users (email, nickname, fullName, passwordHash, enabled, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, true, NOW(), NOW())`,
      [email, nickname, fullName, passwordHash]
    );

    // Delete temporary registration
    await require('../config/db').pool.query(
      'DELETE FROM temp_registrations WHERE registrationCode = ?',
      [registrationCode]
    );

    // Send welcome email
    const welcomeSubject = '¡Bienvenido a la plataforma!';
    const welcomeHtml = `
      <h2>¡Bienvenido/a, ${fullName}!</h2>
      <p>Tu cuenta ha sido creada exitosamente.</p>
      <p>¡Gracias por unirte a nuestra comunidad!</p>
    `;
    await sendEmail(email, welcomeSubject, welcomeHtml);

    res.status(201).json({
      success: true,
      message: 'Registro completado exitosamente',
      userId: result.insertId
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
        message: 'Email es requerido'
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
    const resetSubject = 'Nueva solicitud de cambio de contraseña';
    const resetHtml = `
      <h2>Solicitud cambio de contraseña </h2>
      <p>Tu código de solicitud es: <strong>${result.resetCode}</strong></p>
      <p>Este código expirará en : ${result.codeExpiry}</p>
      <p>Si no has enviado la solicitud. Ignora este mail.</p>
    `;
    await sendEmail(email, resetSubject, resetHtml);

    res.status(200).json({
      success: true,
      message: 'Codigo de cambio de contraseña enviado a tu correo',
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
        message: 'Todos los campos son requeridos'
      });
    }

    // Password validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres y contener al menos una letra y un número'
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
    const confirmSubject = 'Confirmación de cambio de contraseña';
    const confirmHtml = `
      <h2>Confirmación de cambio de contraseña</h2>
      <p>Tu nueva contraseña ha sido actualizada.</p>
      <p>Si no has hecho este cambio. Por favor contacta a nuestro equipo.</p>
    `;
    await sendEmail(email, confirmSubject, confirmHtml);

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};