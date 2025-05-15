const studentModel = require('../models/studentModel');
const userModel = require('../models/userModel');

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
    const { userId, cardNumber, idFront, idBack } = req.body;

    // Validate required fields
    if (!userId || !cardNumber || !idFront || !idBack) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required for student upgrade'
      });
    }

    // Check if user exists
    const user = await userModel.getUserByEmail(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a student
    const existingStudent = await studentModel.getStudentByUserId(userId);
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'User is already a student'
      });
    }

    // Create student record
    const result = await studentModel.createStudent({
      userId,
      cardNumber,
      idFront,
      idBack,
      process: 'PENDING' // Initial status for verification
    });

    res.status(201).json({
      success: true,
      message: 'Student upgrade request submitted successfully',
      studentId: result.studentId
    });
  } catch (error) {
    console.error('Error in upgradeToStudent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

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