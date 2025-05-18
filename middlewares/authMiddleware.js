const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const userModel = require('../models/userModel');

// Promisify jwt.verify
const verifyToken = promisify(jwt.verify);

/**
 * Middleware para verificar el token JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener el token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado. Token no proporcionado.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // Verificar y decodificar el token
      const decoded = await verifyToken(token, process.env.JWT_SECRET);
      
      // Verificar si el usuario existe
      const user = await userModel.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no encontrado. Token inválido.'
        });
      }
      
      // Añadir la información del usuario al objeto de solicitud
      req.user = {
        userId: user.userId,
        email: user.email,
        isAdmin: user.isAdmin || false,
        isVerified: user.isVerified || false
      };
      
      next();
    } catch (error) {
      console.error('Error al verificar el token:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Sesión expirada. Por favor, inicia sesión nuevamente.'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al autenticar.'
    });
  }
};

/**
 * Middleware para verificar si el usuario es administrador
 */
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren privilegios de administrador.'
    });
  }
  next();
};

/**
 * Middleware para verificar si el usuario está verificado
 */
const isVerified = (req, res, next) => {
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Por favor, verifica tu correo electrónico para continuar.'
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  isAdmin,
  isVerified
};
