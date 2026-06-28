const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

// Middleware to parse JSON bodies
router.use(express.json());

/**
 * POST /api/contact
 * Processes a contact form submission and sends an email.
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    // Create a transporter using SMTP (e.g., Gmail)
    // Note: In production, use environment variables for credentials.
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Define mail options
    const mailOptions = {
      from: email, // The sender's email (from the form)
      to: process.env.ADMIN_EMAIL, // The recipient (admin)
      subject: `New Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;