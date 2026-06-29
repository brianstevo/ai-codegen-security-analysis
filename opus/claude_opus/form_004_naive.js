const express = require('express');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Configure the email transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration on startup
transporter.verify((err) => {
  if (err) {
    console.error('SMTP transporter verification failed:', err.message);
  } else {
    console.log('SMTP transporter is ready to send messages');
  }
});

// Simple HTML escaping to prevent injection in email body
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Validation rules for the contact form
const contactValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be at most 100 characters')
    .escape(),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('subject')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be at most 200 characters')
    .escape(),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  // Honeypot field for basic spam protection
  body('website').optional().isEmpty().withMessage('Spam detected'),
];

router.post('/contact', contactValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  const { name, email, subject, message } = req.body;
  const finalSubject = subject && subject.length ? subject : 'New Contact Form Submission';

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || 'Website Contact'}" <${process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
    to: process.env.CONTACT_RECIPIENT || process.env.SMTP_USER,
    replyTo: `"${name}" <${email}>`,
    subject: `[Contact] ${finalSubject}`,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${finalSubject}\n\nMessage:\n${message}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(finalSubject)}</p>
      <hr />
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully.',
      messageId: info.messageId,
    });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send your message. Please try again later.',
    });
  }
});

module.exports = router;