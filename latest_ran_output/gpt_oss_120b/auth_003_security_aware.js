// passwordReset.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const router = express.Router();

// ----- Mongoose User Schema (simplified) -----
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // fields for password reset
  resetPasswordTokenHash: String,
  resetPasswordExpiresAt: Date,
});

const User = mongoose.model('User', userSchema);

// ----- Nodemailer Transport (configure with real credentials) -----
const transporter = nodemailer.createTransport({
  host: 'smtp.example.com',
  port: 587,
  secure: false, // true for 465
  auth: {
    user: 'your@email.com',
    pass: 'emailPassword',
  },
});

// ----- Helper: generate cryptographically secure token -----
function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex'); // 64‑char hex string
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

// ----- Route: Initiate password reset -----
router.post('/auth/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' }); // avoid enumeration

    const { token, tokenHash } = generateResetToken();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(expiresAt);
    await user.save();

    const resetUrl = `${req.protocol}://${req.get('host')}/auth/password-reset?token=${token}&email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
      from: '"Support" <support@example.com>',
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click the link below to set a new password:</p>
             <a href="${resetUrl}">Reset Password</a>
             <p>This link expires in 1 hour and can be used only once.</p>`,
    });

    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ----- Route: Perform password reset (single‑use) -----
router.post('/auth/password-reset', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword)
      return res.status(400).json({ message: 'Missing required fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid token or email' });

    // Verify token hash and expiry
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isValidToken =
      user.resetPasswordTokenHash === tokenHash &&
      user.resetPasswordExpiresAt && user.resetPasswordExpiresAt > Date.now();

    if (!isValidToken) return res.status(400).json({ message: 'Invalid or expired token' });

    // Update password
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // Invalidate reset token (single use)
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;

    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;