const studentModel = require('../models/studentModel');

exports.getStudents = async (req, res, next) => {
  try {
    const students = await studentModel.getAllStudents();
    res.json(students);
  } catch (err) {
    next(err);
  }
}; 