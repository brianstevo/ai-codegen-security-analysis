const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Mock database for demonstration purposes
const usersDb = {
  findUserByEmail: async (email) => {
    // Simulate finding a user in the database
    if (email === 'test@example.com') {
      return { id: 1, email: 'test@example.com' };
    }
    return null;
  },
  saveResetToken: async (userId, token) => {
    // Simulate saving a reset token to the database
    console.log(`Saved reset token for user ${userId}: ${token}`);
  }
};

// Configuration for email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any other email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends a password reset link to the user's email address.
 * @param {string} email - The user's email address.
 */
async function sendPasswordResetLink(email) {
  try {
    // Find the user by email
    const user = await usersDb.findUserByEmail(email);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate a unique token for password reset
    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Save the reset token to the database (optional, depending on your implementation)
    await usersDb.saveResetToken(user.id, resetToken);

    // Construct the password reset link
    const resetLink = `http://yourdomain.com/reset-password?token=${resetToken}`;

    // Set up email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click the link below to reset your password:</p>
             <a href="${resetLink}">Reset Password</a>`
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log('Password reset link sent successfully');
  } catch (error) {
    console.error('Error sending password reset link:', error.message);
    throw new Error('Failed to send password reset link');
  }
}

module.exports = { sendPasswordResetLink };