const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Mock database (replace with actual DB in production)
let users = [
  { id: 1, email: 'user@example.com', passwordResetToken: null, passwordResetExpires: null }
];

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Function to generate reset token
function generateResetToken() {
  return crypto.randomBytes(20).toString('hex');
}

// Password reset endpoint
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Find user in database
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate reset token and expiration time (1 hour)
  const resetToken = generateResetToken();
  const expiresIn = 60 * 60; // 1 hour in seconds

  // Save token to user record
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + expiresIn * 1000;

  // Create password reset link (using JWT for security)
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${jwt.sign({ email, token: resetToken }, process.env.JWT_SECRET, { expiresIn })}`;

  try {
    // Send email with reset link
    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
      `
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending password reset email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));