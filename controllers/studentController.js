const studentModel = require('../models/studentModel');
const userModel = require('../models/userModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/students';
    // Crear el directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de archivos para solo permitir imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

// Configuración de multer
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
}).fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 }
]);

// Middleware para manejar la subida de archivos
const handleFileUpload = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Error de multer al subir el archivo
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      // Otro tipo de error
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    // Si no hay errores, continuar
    next();
  });
};

exports.getStudents = async (req, res, next) => {
  try {
    const students = await studentModel.getAllStudents();
    res.json(students);
  } catch (err) {
    next(err);
  }
};

// Upgrade to student account
exports.upgradeToStudent = async (req, res) => {
  try {
    // Verificar si se subieron los archivos
    if (!req.files || !req.files.idFront || !req.files.idBack) {
      return res.status(400).json({
        success: false,
        message: 'Debe subir ambas imágenes del documento de identidad'
      });
    }

    const { userId, cardNumber } = req.body;

    // Validar campos requeridos
    if (!userId || !cardNumber) {
      // Eliminar archivos subidos si hay error de validación
      if (req.files.idFront) {
        fs.unlinkSync(req.files.idFront[0].path);
      }
      if (req.files.idBack) {
        fs.unlinkSync(req.files.idBack[0].path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Validar formato del número de tarjeta (16 dígitos)
    const cardNumberClean = cardNumber.replace(/\s/g, '');
    if (!/^\d{16}$/.test(cardNumberClean)) {
      // Eliminar archivos subidos si hay error de validación
      if (req.files.idFront) {
        fs.unlinkSync(req.files.idFront[0].path);
      }
      if (req.files.idBack) {
        fs.unlinkSync(req.files.idBack[0].path);
      }
      
      return res.status(400).json({
        success: false,
        message: 'El número de tarjeta debe tener 16 dígitos'
      });
    }

    // Check if user exists
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Check if user is already a student
    const existingStudent = await studentModel.getUserById(userId);
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Usuario ya es estudiante'
      });
    }

    // Crear registro de estudiante con rutas de los archivos
    const result = await studentModel.createStudent({
      userId,
      cardNumber: cardNumberClean,
      idFront: req.files.idFront[0].path,
      idBack: req.files.idBack[0].path,
      process: 'pending' // Estado inicial para verificación
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud de estudiante enviada exitosamente',
      data: {
        studentId: result.studentId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error al actualizar a estudiante:', error);
    
    // Intentar eliminar archivos subidos en caso de error
    try {
      if (req.files && req.files.idFront && req.files.idFront[0]) {
        fs.unlinkSync(req.files.idFront[0].path);
      }
      if (req.files && req.files.idBack && req.files.idBack[0]) {
        fs.unlinkSync(req.files.idBack[0].path);
      }
    } catch (fileError) {
      console.error('Error al limpiar archivos subidos:', fileError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud'
    });
  }
};

// Agregar el middleware de manejo de archivos a la función upgradeToStudent
exports.upgradeToStudent = [
  handleFileUpload,
  exports.upgradeToStudent
];

// Get student status
exports.getStudentStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const student = await studentModel.getStudentByUserId(userId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        studentId: student.studentId,
        process: student.process,
        accountBalance: student.accountBalance,
        cardNumber: student.cardNumber
      }
    });
  } catch (error) {
    console.error('Error in getStudentStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update student process status (admin only)
exports.updateProcessStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { process } = req.body;

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(process)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid process status'
      });
    }

    await studentModel.updateStudentProcess(studentId, process);

    res.status(200).json({
      success: true,
      message: 'Student process status updated successfully'
    });
  } catch (error) {
    console.error('Error in updateProcessStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update account balance
exports.updateBalance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { amount } = req.body;

    if (typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    await studentModel.updateAccountBalance(studentId, amount);

    res.status(200).json({
      success: true,
      message: 'Account balance updated successfully'
    });
  } catch (error) {
    console.error('Error in updateBalance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 