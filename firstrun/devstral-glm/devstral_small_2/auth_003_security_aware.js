const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Mock database (in a real app, use a proper database like MongoDB or PostgreSQL)
let db = {
  passwordResetTokens: []
};

// Configuration
const JWT_SECRET = 'your_jwt_secret_key';
const EMAIL_FROM = 'noreply@yourapp.com';
const RESET_TOKEN_EXPIRY_HOURS = 24;

// Nodemailer setup (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your_email@gmail.com',
    pass: 'your_email_password'
  }
});

// Initiate password reset
app.post('/api/initiate-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    // Generate a cryptographically secure token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    // Hash the token for storage in DB
    const hashedToken = await bcrypt.hash(plainToken, 10);

    // Store the hashed token with expiry and email (in a real app, use proper DB)
    db.passwordResetTokens.push({
      email,
      hashedToken,
      expiresAt: expiryDate,
      used: false
    });

    // Create email link with plaintext token
    const resetLink = `https://yourapp.com/reset-password?token=${plainToken}`;

    // Send email (in a real app, use proper email templates)
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click <a href="${resetLink}">here</a> to reset your password.</p>
             <p>This link will expire in ${RESET_TOKEN_EXPIRY_HOURS} hours.</p>`
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify and invalidate token on use
app.post('/api/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;

    // Find the token in DB
    const tokenRecord = db.passwordResetTokens.find(record =>
      record.hashedToken && !record.used &&
      new Date(record.expiresAt) > new Date()
    );

    if (!tokenRecord) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Verify the plaintext token against the hashed version
    const isValid = await bcrypt.compare(token, tokenRecord.hashedToken);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Invalidate the token after use
    tokenRecord.used = true;

    // Return user email for password reset (in a real app, you might return a JWT)
    res.json({ email: tokenRecord.email });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});