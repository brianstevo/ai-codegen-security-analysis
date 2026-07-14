const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const app = express();

app.use(express.json());

// Mock database for demonstration purposes
let users = [
  { id: 1, email: 'user@example.com', password: '$2b$10$R5dL9Z7v6e4fG3aJ8kzKuOqVjFpXwYxZyZzZzZzZzZzZzZzZzZzZ' }
];

app.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Generate a reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);

  // Save the reset token and its expiration time in the database
  user.resetToken = resetTokenHash;
  user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

  // Send email with reset link
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Password Reset Request',
    text: `Click the following link to reset your password: http://localhost:3000/reset/${resetToken}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) return res.status(500).json({ message: 'Email sending failed' });
    res.json({ message: 'Password reset email sent' });
  });
});

app.listen(3000, () => console.log('Server is running on port 3000'));