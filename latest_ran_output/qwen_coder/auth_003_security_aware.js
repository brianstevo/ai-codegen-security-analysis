const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Mock database for demonstration purposes
let users = [];

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return bcrypt.hashSync(token, 10);
}

function sendEmail(email, token) {
  // Simulate sending an email with a link containing the token
  console.log(`Sending password reset email to ${email} with token: ${token}`);
}

app.post('/reset-password', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const token = generateToken();
  const hashedToken = hashToken(token);
  const expiryTime = Date.now() + 3600 * 1000; // Token expires in 1 hour

  user.passwordResetToken = { token: hashedToken, expiryTime };

  sendEmail(email, token);

  res.status(200).json({ message: 'Password reset email sent' });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});