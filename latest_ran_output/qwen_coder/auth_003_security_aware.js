const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Mock database for demonstration purposes
let users = [];

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-password'
  }
});

async function initiatePasswordReset(email) {
  const user = users.find(u => u.email === email);
  if (!user) return { error: 'User not found' };

  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = await bcrypt.hash(token, 10);

  // Store the hashed token in the database with an expiry time
  user.resetToken = hashedToken;
  user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

  // Send the plaintext token in the email link
  const resetLink = `http://example.com/reset-password?token=${token}`;
  await transporter.sendMail({
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Password Reset Request',
    text: `Click the following link to reset your password: ${resetLink}`
  });

  return { message: 'Password reset email sent' };
}

app.post('/password-reset', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await initiatePasswordReset(email);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});