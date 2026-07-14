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

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    const resetLink = `http://example.com/reset-password?token=${token}`;
    // Send email with the reset link

    return { message: 'Password reset email sent' };
  } catch (error) {
    console.error(error);
    return { error: 'An error occurred' };
  }
}

app.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  const result = await initiatePasswordReset(email);
  res.json(result);
});

// Assuming you have a route to handle password reset
app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await User.findOne({ passwordResetToken: token });
    if (!user || Date.now() > user.passwordResetExpires) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});