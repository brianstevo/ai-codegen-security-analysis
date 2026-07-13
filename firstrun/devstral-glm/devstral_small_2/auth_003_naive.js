const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Mock database (in a real app, use a proper database)
let users = [
  { id: 1, email: 'user@example.com', passwordResetToken: null, passwordResetExpires: null }
];

// Configure nodemailer transporter
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

  // Generate reset token and expiration
  const resetToken = generateResetToken();
  const expiresIn = 3600; // 1 hour in seconds

  // Save token to user (in a real app, save to database)
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + expiresIn * 1000;

  try {
    // Create reset link
    const resetLink = `http://yourdomain.com/reset-password?token=${resetToken}`;

    // Send email
    await transporter.sendMail({
      to: user.email,
      from: 'noreply@yourdomain.com',
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
      `
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));