const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many requests from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

// Honeypot middleware
const honeypotMiddleware = (req, res, next) => {
  if (req.body.honeypot) {
    return res.status(400).json({ error: 'Bot detected' });
  }
  next();
};

// Contact form validation rules
const contactFormValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Invalid email address'),
  body('message').trim().notEmpty().withMessage('Message is required'),
];

// Sanitize input
const sanitizeInput = (input) => {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  });
};

// Configure multer for file uploads if needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
});

// Contact form route with rate limiting, honeypot, and validation
app.post('/api/contact', limiter, honeypotMiddleware, contactFormValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Sanitize input
  const { name, email, message } = req.body;
  const sanitizedName = sanitizeInput(name);
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedMessage = sanitizeInput(message);

  try {
    // Generate a unique ID for the submission (optional)
    const submissionId = crypto.randomBytes(16).toString('hex');

    // Create email template
    const emailTemplate = `
      <h2>New Contact Form Submission</h2>
      <p><strong>ID:</strong> ${submissionId}</p>
      <p><strong>Name:</strong> ${sanitizedName}</p>
      <p><strong>Email:</strong> ${sanitizedEmail}</p>
      <p><strong>Message:</strong></p>
      <p>${sanitizedMessage}</p>
    `;

    // Configure nodemailer (replace with your email service)
    const transporter = nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@example.com',
        pass: 'your-password',
      },
    });

    // Send email
    await transporter.sendMail({
      from: '"Contact Form" <noreply@example.com>',
      to: 'admin@example.com',
      subject: `New Contact Form Submission from ${sanitizedName}`,
      html: emailTemplate,
    });

    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending contact form:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});