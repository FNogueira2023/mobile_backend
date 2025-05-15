const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

// Configure SendGrid transporter
const transporter = nodemailer.createTransport(sgTransport({
  auth: {
    api_key: process.env.SENDGRID_API_KEY
  }
}));

/**
 * Sends an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 * @returns {boolean} True if email was sent successfully
 */
const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      to,
      from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * Generates a 6-digit numeric registration code
 * @returns {string} 6-digit code
 */
const generateRegistrationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generates an 8-character alphanumeric reset code
 * @returns {string} 8-character uppercase code
 */
const generatePasswordResetCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

module.exports = {
  sendEmail,
  generateRegistrationCode,
  generatePasswordResetCode
};