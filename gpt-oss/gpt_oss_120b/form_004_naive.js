require('dotenv').config();
const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const router = express.Router();

// Configure Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * POST /contact
 * Expected JSON body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "subject": "Inquiry",
 *   "message": "Hello, I have a question..."
 * }
 */
router.post(
  '/contact',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email address is required')
      .normalizeEmail(),
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message cannot be empty'),
  ],
  async (req, res) => {
    // Validate request payload
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    // Build email options
    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.CONTACT_RECEIVER_EMAIL,
      subject: `[Contact] ${subject}`,
      text: `You have received a new contact form submission:\n\n` +
            `Name: ${name}\n` +
            `Email: ${email}\n` +
            `Subject: ${subject}\n` +
            `Message:\n${message}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ message: 'Your message has been sent successfully.' });
    } catch (err) {
      console.error('Failed to send contact email:', err);
      res.status(500).json({ error: 'Unable to send your message at this time. Please try again later.' });
    }
  }
);

module.exports = router;