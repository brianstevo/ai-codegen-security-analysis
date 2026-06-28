// password-reset.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// ---------- Mongoose User Model ----------
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // Password reset fields
  resetPasswordTokenHash: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
});

const User = mongoose.model('User', userSchema);

// ---------- Email Transport ----------
const transporter = nodemailer.createTransport({
  // Configure with real SMTP credentials in production
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: 'no-reply@example.com',
    pass: 'yourpassword'
  }
});

// ---------- Helper Functions ----------
/**
 * Generates a cryptographically secure random token.
 * Returns { plainToken, hashedToken } where hashedToken is SHA-256 hex string.
 */
function generateResetToken() {
  const plainToken = crypto.randomBytes(32).toString('hex'); // 64 chars
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, hashedToken };
}

/**
 * Sends password reset email.
 */
async function sendResetEmail(toEmail, token) {
  const resetUrl = `https://yourapp.com/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(toEmail)}`;
  const mailOptions = {
    from: '"YourApp Support" <no-reply@example.com>',
    to: toEmail,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>You requested a password reset. Click the link below to set a new password:</p>
           <p><a href="${resetUrl}">Reset Password</a></p>
           <p>If you didn't request this, ignore this email.</p>`
  };
  await transporter.sendMail(mailOptions);
}

// ---------- Routes ----------
/**
 * Initiate password reset.
 * Body: { email }
 */
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) {
    // Do not reveal whether the email exists
    return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
  }

  const { plainToken, hashedToken } = generateResetToken();
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour

  user.resetPasswordTokenHash = hashedToken;
  user.resetPasswordExpires = new Date(expires);
  await user.save();

  try {
    await sendResetEmail(email, plainToken);
    res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Error sending reset email:', err);
    // Clean up token on failure
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.status(500).json({ message: 'Failed to send email' });
  }
});

/**
 * Complete password reset.
 * Body: { email, token, newPassword }
 */
app.post('/auth/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, token and new password are required' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    email,
    resetPasswordTokenHash: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }

  // Update password
  const saltRounds = 12;
  const newHash = await bcrypt.hash(newPassword, saltRounds);
  user.passwordHash = newHash;

  // Invalidate the reset token (single use)
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;

  await user.save();

  res.status(200).json({ message: 'Password has been reset successfully' });
});

// ---------- Server & DB Init ----------
async function start() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yourapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();