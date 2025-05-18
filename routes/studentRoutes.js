const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

// Middleware para verificar que el usuario es el dueño del recurso o es admin
const isOwnerOrAdmin = (req, res, next) => {
  const { userId } = req.user; // Asumiendo que el token JWT incluye el userId
  const requestedUserId = req.params.userId;
  
  if (userId === requestedUserId || req.user.isAdmin) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'No tienes permiso para acceder a este recurso'
  });
};

// Obtener todos los estudiantes (solo admin)
router.get('/', authenticateToken, isAdmin, async (req, res, next) => {
  try {
    const students = await studentController.getAllStudents();
    res.json(students);
  } catch (err) {
    next(err);
  }
});

// Actualizar a cuenta de estudiante
router.post('/upgrade', authenticateToken, studentController.upgradeToStudent);

// Obtener estado de estudiante
router.get('/status/:userId', authenticateToken, isOwnerOrAdmin, studentController.getStudentStatus);

// Actualizar estado de verificación (solo admin)
router.patch(
  '/:studentId/process',
  authenticateToken,
  isAdmin,
  studentController.updateProcessStatus
);

// Actualizar saldo de cuenta (solo admin)
router.patch(
  '/:studentId/balance',
  authenticateToken,
  isAdmin,
  studentController.updateBalance
);

module.exports = router;