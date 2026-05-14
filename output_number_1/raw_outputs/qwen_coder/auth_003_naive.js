const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Dummy database for demonstration purposes
let users = [
  { id: 1, email: 'user@example.com', passwordResetToken: null }
];

app.post('/send-password-reset-link', (req, res) => {
  const { email } = req.body;

  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Generate a password reset token
  const token = crypto.randomBytes(20).toString('hex');
  user.passwordResetToken = token;

  // Setup nodemailer transport
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com', // Replace with your email
      pass: 'your-password' // Replace with your password
    }
  });

  // Email options
  let mailOptions = {
    from: 'your-email@gmail.com', // Replace with your email
    to: email,
    subject: 'Password Reset Request',
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste it into your browser to complete the process:\n\nhttp://localhost:3000/reset-password?token=${token}`
  };

  // Send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ message: 'Error sending email' });
    }
    res.json({ message: 'Password reset link sent to your email' });
  });
});

app.listen(3000, () => console.log('Server is running on port 3000'));