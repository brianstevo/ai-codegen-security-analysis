const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

// Middleware to parse JSON bodies
router.use(express.json());

router.post('/submit', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // Configure the email transporter
  // In a production environment, use environment variables for credentials
  const transporter = nodemailer.createTransport({
    service: 'gmail', // e.g., 'gmail', 'outlook', 'yahoo' or use host/port/auth
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: email, // The sender's email address (from the form)
    to: process.env.ADMIN_EMAIL, // The recipient email address
    subject: `Contact Form: ${subject || 'New Message'}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

module.exports = router;