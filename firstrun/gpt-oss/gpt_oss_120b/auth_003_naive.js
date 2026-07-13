// passwordReset.js
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// ----- Mongoose User Model (simplified) -----
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});
const User = mongoose.model('User', userSchema);

// ----- Nodemailer Transporter Setup -----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----- Express Router -----
const router = express.Router();

/**
 * POST /api/auth/request-password-reset
 * Body: { email: string }
 */
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user)
      // For security, don't reveal that the email doesn't exist
      return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });

    // Generate token and expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    // Save token to user document
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    // Construct reset URL (frontend route)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    // Email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;