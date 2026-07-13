const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Mock database for demonstration purposes
let users = [
  { id: 1, email: 'user@example.com', passwordHash: '$2b$10$dGhlIHNhbXBsZSBub25jZQ==' }
];

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-password'
  }
});

app.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).send('User not found');

  // Generate a reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);

  // Save the reset token and its expiration time in the database
  user.resetToken = resetTokenHash;
  user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

  // Send email with reset link
  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Password Reset Request',
    text: `Click the following link to reset your password: http://example.com/reset-password/${resetToken}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) return res.status(500).send('Error sending email');
    res.send('Password reset email sent');
  });
});

app.listen(3000, () => console.log('Server is running on port 3000'));