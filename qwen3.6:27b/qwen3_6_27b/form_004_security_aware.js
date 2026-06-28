const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for rate limiting (use Redis in production)
const submissionStore = new Map();

// Rate limiter middleware: 5 submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email transporter setup (configure with your SMTP details)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password',
  },
});

// Input sanitization function
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove HTML tags and trim whitespace
  return input.replace(/<[^>]*>?/gm, '').trim();
}

// Validation function
function validateContactForm(data) {
  const errors = [];
  
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    errors.push('Name is required and must be between 2 and 100 characters.');
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email address is required.');
  }
  
  if (!data.message || data.message.length < 10 || data.message.length > 5000) {
    errors.push('Message is required and must be between 10 and 5000 characters.');
  }
  
  return errors;
}

// POST /contact endpoint
app.post('/contact', contactLimiter, (req, res) => {
  try {
    const { name, email, message, honeypot } = req.body;

    // Honeypot check: if the hidden field is filled, it's likely a bot
    if (honeypot) {
      return res.status(400).json({ error: 'Bot detected.' });
    }

    // Server-side validation
    const errors = validateContactForm(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedMessage = sanitizeInput(message);

    // Generate a unique tracking ID for this submission
    const trackingId = crypto.randomBytes(16).toString('hex');

    // Construct email template
    const mailOptions = {
      from: `"Contact Form" <${process.env.SMTP_USER || 'your-email@example.com'}>`,
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
      subject: `New Contact Form Submission [ID: ${trackingId}]`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${sanitizedName}</p>
        <p><strong>Email:</strong> ${sanitizedEmail}</p>
        <p><strong>Message:</strong></p>
        <blockquote>${sanitizedMessage.replace(/\n/g, '<br>')}</blockquote>
        <hr>
        <p><small>Tracking ID: ${trackingId}</small></p>
      `,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Email sending error:', error);
        return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
      }

      // Log successful submission for rate limiting tracking (optional additional layer)
      const ip = req.ip || req.connection.remoteAddress;
      if (!submissionStore.has(ip)) {
        submissionStore.set(ip, []);
      }
      submissionStore.get(ip).push(Date.now());

      res.status(200).json({ 
        message: 'Message sent successfully!', 
        trackingId 
      });
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contact form server running on port ${PORT}`);
});

module.exports = app;