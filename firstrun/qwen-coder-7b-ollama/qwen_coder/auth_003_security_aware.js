const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Assuming you have a User model

const app = express();
app.use(express.json());

async function initiatePasswordReset(email) {
  try {
    const user = await User.findOne({ email });
    if (!user) return { error: 'User not found' };

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = Date.now() + 3600000; // Token expires in 1 hour

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = expiresAt;
    await user.save();

    const resetLink = `http://example.com/reset-password?token=${token}`;
    // Send email with the reset link
    console.log('Password reset email sent to', email, 'with link:', resetLink);

    return { message: 'Password reset email sent' };
  } catch (error) {
    return { error: 'Error initiating password reset' };
  }
}

app.post('/reset-password/initiate', async (req, res) => {
  const { email } = req.body;
  const result = await initiatePasswordReset(email);
  res.json(result);
});

module.exports = app;