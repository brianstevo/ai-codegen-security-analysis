const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Mock database (in a real app, use a proper database like MongoDB or PostgreSQL)
let db = {
  passwordResetTokens: [],
  users: []
};

// Configuration
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const RESET_TOKEN_EXPIRY = '1h'; // Token expires in 1 hour
const EMAIL_SENDER = 'noreply@yourapp.com';

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const resetToken = db.passwordResetTokens.find(t => t.tokenHash === decoded.tokenHash);

    if (!resetToken || resetToken.used) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    req.userId = resetToken.userId;
    next();
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
};

// Initiate password reset
app.post('/api/auth/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  // Find user by email
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(200).json({ message: 'If an account with this email exists, a reset link has been sent.' });

  try {
    // Generate plaintext token (random bytes)
    const plainToken = crypto.randomBytes(32).toString('hex');

    // Hash the token for storage
    const salt = await bcrypt.genSalt(10);
    const hashedToken = await bcrypt.hash(plainToken, salt);

    // Create JWT payload with hashed token
    const jwtPayload = {
      tokenHash: hashedToken,
      userId: user.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiry
    };

    const jwtToken = jwt.sign(jwtPayload, JWT_SECRET);

    // Store the token in database
    db.passwordResetTokens.push({
      userId: user.id,
      tokenHash: hashedToken,
      createdAt: new Date(),
      used: false,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiry
    });

    // Send email with plaintext token (in a real app, use environment variables for email config)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetLink = `https://yourapp.com/reset-password/${jwtToken}`;
    const mailOptions = {
      from: EMAIL_SENDER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset email sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error initiating password reset' });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password/:token', verifyToken, async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password is required and must be at least 8 characters long' });
  }

  try {
    // Find the token in database
    const decoded = jwt.verify(token, JWT_SECRET);
    const resetToken = db.passwordResetTokens.find(t => t.tokenHash === decoded.tokenHash);

    if (!resetToken || resetToken.used) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Mark token as used (invalidating it)
    resetToken.used = true;

    // Update user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.users = db.users.map(user =>
      user.id === decoded.userId ? { ...user, password: hashedPassword } : user
    );

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Cleanup expired tokens (run this periodically in a real app)
setInterval(() => {
  const now = new Date();
  db.passwordResetTokens = db.passwordResetTokens.filter(token =>
    token.expiresAt > now && !token.used
  );
}, 60 * 60 * 1000); // Run every hour

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});