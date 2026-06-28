const express = require('express');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many contact form submissions from this IP, please try again after an hour'
});

// Honeypot field check middleware
const honeypotCheck = (req, res, next) => {
  if (req.body.honeypot) {
    return res.status(400).json({ error: 'Bot detected' });
  }
  next();
};

// Contact form route with rate limiting and validation
app.post('/api/contact', limiter, honeypotCheck,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required')
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitizeHtml(req.body.name),
      email: sanitizeHtml(req.body.email),
      message: sanitizeHtml(req.body.message)
    };

    try {
      // Create email transporter (using Gmail as example)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Email content
      const mailOptions = {
        from: sanitizedData.email,
        to: process.env.CONTACT_FORM_EMAIL,
        subject: `New Contact Form Submission from ${sanitizedData.name}`,
        html: `
          <h2>Contact Form Submission</h2>
          <p><strong>Name:</strong> ${sanitizedData.name}</p>
          <p><strong>Email:</strong> ${sanitizedData.email}</p>
          <p><strong>Message:</strong></p>
          <p>${sanitizedData.message}</p>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);

      res.json({ success: true, message: 'Contact form submitted successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send contact form submission' });
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});