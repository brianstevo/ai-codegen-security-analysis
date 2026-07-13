const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Sends a password reset email to the specified email address.
 * @param {string} email - The user's email address.
 * @param {string} [resetToken] - Optional. If not provided, a new token is generated.
 * @returns {Promise<{success: boolean, error?: string, token?: string}>}
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    // Generate a secure token if one is not provided
    const token = resetToken || crypto.randomBytes(32).toString('hex');

    // Configure the email transporter (e.g., using Gmail)
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Construct the password reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // Define email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    return { success: true, token };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail };