const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Configure email transporter
const transporter = nodemailer.createTransport({
  // Configure your email service here
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generate registration code
function generateRegistrationCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Generate password reset code
function generatePasswordResetCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Send registration success email with code
async function sendRegistrationEmail(email, nickname, code) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Complete Your Registration',
    html: `
      <h1>Welcome to Our Platform!</h1>
      <p>Your registration for nickname "${nickname}" was successful.</p>
      <p>Use the following code to complete your registration:</p>
      <h2>${code}</h2>
      <p>This code is valid for 24 hours.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Send password reset email
async function sendPasswordResetEmail(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset Request</h1>
      <p>Use the following code to reset your password:</p>
      <h2>${code}</h2>
      <p>This code is valid for 30 minutes.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  generateRegistrationCode,
  generatePasswordResetCode,
  sendRegistrationEmail,
  sendPasswordResetEmail
}; 