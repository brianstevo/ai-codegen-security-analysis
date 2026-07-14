const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

// Configure transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Contact form submission route with validation
router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Send email
      await transporter.sendMail({
        from: `"Contact Form" <${req.body.email}>`,
        to: process.env.EMAIL_USER,
        subject: `New message from ${req.body.name}`,
        text: `${req.body.message}\n\nReply to: ${req.body.email}`,
        html: `<p>${req.body.message}</p><br><p>Reply to: <a href="mailto:${req.body.email}">${req.body.email}</a></p>`,
      });

      res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Email error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }
);

module.exports = router;