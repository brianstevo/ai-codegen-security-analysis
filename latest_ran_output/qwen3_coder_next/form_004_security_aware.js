const express = require('express');
const { body, validationResult, sanitizeBody } = require('express-validator');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration (5 submissions per IP per hour)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  handler: (req, res) => {
    return res.status(429).json({ 
      success: false, 
      message: 'Too many contact form submissions. Please try again later.' 
    });
  }
});

// Honeypot field name
const HONEYPOT_FIELD = 'website';

// Email template function (simple HTML)
function createEmailTemplate(name, email, message) {
  return `
    <html>
      <body>
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${sanitizeHtml(name)}</p>
        <p><strong>Email:</strong> ${sanitizeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <div>${sanitizeHtml(message).replace(/\n/g, '<br>')}</div>
      </body>
    </html>
  `;
}

// Basic HTML sanitization function
function sanitizeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Email sending mock function (in production, use a service like Nodemailer)
async function sendEmail(emailTemplate) {
  // In real implementation:
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({...});
  // await transporter.sendMail({ from: 'contact@yoursite.com', to: 'you@yoursite.com', html: emailTemplate });
  
  console.log('Email sent with template:', emailTemplate.substring(0, 100) + '...');
  return true;
}

// Contact form validation and submission handler
app.post('/contact',
  contactLimiter,
  [
    // Validate name field (required, min length)
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters long')
      .escape(),
    
    // Validate email field
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    // Validate message field (required, min length)
    body('message')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Message must be at least 10 characters long')
      .escape(),
    
    // Honeypot validation
    body(HONEYPOT_FIELD).custom((value) => {
      if (value && value.length > 0) {
        throw new Error('Bot detected');
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }
      
      // Extract and sanitize validated data
      const { name, email, message } = req.body;
      
      // Create sanitized email template
      const emailTemplate = createEmailTemplate(name, email, message);
      
      // Send the email (mock implementation)
      await sendEmail(emailTemplate);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Your message has been sent successfully.' 
      });
    } catch (error) {
      console.error('Contact form error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'An error occurred while processing your submission. Please try again later.' 
      });
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contact form server running on port ${PORT}`);
});