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
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many contact form submissions from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Honeypot field name (should be hidden in the frontend)
const HONEYPOT_FIELD = 'website';

// Email template function with sanitization
function createEmailTemplate(name, email, message) {
  return `
    Contact Form Submission
    
    Name: ${sanitizeBody(name).trim()}
    Email: ${sanitizeBody(email).trim()}
    Message: ${sanitizeBody(message).trim().replace(/\r?\n/g, '<br>')}
    
    IP Address: ${crypto.createHash('md5').update(req.ip).digest('hex')} (hashed for privacy)
  `;
}

// Contact form validation and sanitization middleware
const contactValidation = [
  // Validate name field
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, apostrophes, and hyphens'),
  
  // Validate email field
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Validate message field
  body('message')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Message must be between 10 and 500 characters')
];

// Contact form handler with all security measures
app.post('/contact', contactLimiter, contactValidation, (req, res) => {
  // Check for honeypot field - if filled, it's likely a bot
  if (req.body[HONEYPOT_FIELD]) {
    return res.status(403).json({
      success: false,
      error: 'Bot detected. Honeypot field was filled.'
    });
  }

  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => err.msg) 
    });
  }

  try {
    // Sanitize all inputs
    const name = sanitizeBody(req.body.name).trim();
    const email = sanitizeBody(req.body.email).trim().toLowerCase();
    const message = sanitizeBody(req.body.message).trim();

    // In a real application, you would send the email here using a service like Nodemailer
    // For this example, we'll just simulate successful processing
    
    console.log('Contact form submission processed:', {
      name,
      email,
      message: createEmailTemplate(name, email, message)
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will contact you soon.'
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while processing your submission. Please try again later.'
    });
  }
});

// Error handling middleware for express-rate-limit
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON' });
  }
  
  // Handle rate limit errors specifically
  if (err.message.includes('Too many requests')) {
    return res.status(429).json({
      success: false,
      error: err.message
    });
  }
  
  next(err);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});