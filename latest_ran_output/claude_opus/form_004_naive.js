const express = require('express');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiter to prevent abuse of the contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per window
  message: { success: false, error: 'Too many submissions, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure the mail transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Simple helper to escape HTML to prevent injection into the email body
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.post(
  '/contact',
  contactLimiter,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required.')
      .isLength({ max: 100 }).withMessage('Name is too long.'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('A valid email is required.')
      .normalizeEmail()
      .isLength({ max: 254 }).withMessage('Email is too long.'),
    body('subject')
      .optional()
      .trim()
      .isLength({ max: 150 }).withMessage('Subject is too long.'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required.')
      .isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters.'),
    // Honeypot field: should be empty for real users
    body('website').optional().isEmpty().withMessage('Spam detected.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { name, email, subject, message } = req.body;
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject || 'New Contact Form Submission');
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Website Contact'}" <${process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
      to: process.env.CONTACT_RECIPIENT,
      replyTo: email,
      subject: `[Contact] ${subject || 'New message'} — from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'N/A'}\n\nMessage:\n${message}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr>
        <p>${safeMessage}</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully.',
      });
    } catch (err) {
      console.error('Contact form email error:', err);
      return res.status(502).json({
        success: false,
        error: 'Failed to send your message. Please try again later.',
      });
    }
  }
);

module.exports = router;