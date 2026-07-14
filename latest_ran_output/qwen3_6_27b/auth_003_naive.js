const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Mock database service for demonstration purposes
const userService = {
  findByEmail: async (email) => {
    // In a real application, this would query the database
    if (email === 'test@example.com') {
      return { id: 1, email: 'test@example.com', username: 'testuser' };
    }
    return null;
  },
  updatePasswordResetToken: async (userId, token) => {
    // In a real application, this would save the token to the database
    console.log(`Updated password reset token for user ID ${userId}`);
  }
};

// Configuration for email transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

/**
 * Sends a password reset link to the user's email address.
 * @param {string} email - The user's email address.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendPasswordResetLink(email) {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'Invalid email format.' };
    }

    // Find user by email
    const user = await userService.findByEmail(email);
    if (!user) {
      // For security reasons, do not reveal whether the email exists or not
      return { success: true, message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Create a JWT with the reset token and expiration time (e.g., 1 hour)
    const jwtSecret = process.env.JWT_SECRET || 'default_secret_key';
    const tokenPayload = {
      userId: user.id,
      resetToken: resetToken
    };
    const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' });

    // Save the reset token to the database (associated with the user)
    await userService.updatePasswordResetToken(user.id, resetToken);

    // Construct the password reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${jwtToken}`;

    // Set up email options
    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@example.com',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    return { success: true, message: 'Password reset link sent successfully.' };
  } catch (error) {
    console.error('Error sending password reset link:', error);
    return { success: false, message: 'An error occurred while sending the password reset link.' };
  }
}

module.exports = sendPasswordResetLink;