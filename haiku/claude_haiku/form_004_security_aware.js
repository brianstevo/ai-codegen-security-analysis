```javascript
import express from 'express';
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Store for IP-based rate limiting (in-memory)
const ipSubmissions = {};

// Rate limiting middleware - max 5 submissions per IP per hour
const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Initialize or get submissions for this IP
  if (!ipSubmissions[ip]) {
    ipSubmissions[ip] = [];
  }

  // Remove submissions older than 1 hour
  ipSubmissions[ip] = ipSubmissions[ip].filter(time => time > oneHourAgo);

  // Check if limit exceeded
  if (ipSubmissions[ip].length >= 5) {
    return res.status(429).json({
      success: false,
      error: 'Too many submissions. Please try again later.'
    });
  }

  // Record this submission
  ipSubmissions[ip].push(now);
  next();
};

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

const validateName = (name) => {
  return name.length >= 2 && name.length <= 100 && /^[a-zA-Z\s'-]+$/.test(name);
};

const validateMessage = (message) => {
  return message.length >= 10 && message.length <= 5000;
};

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return xss(input.trim(), {
    whiteList: {},
    stripIgnoredTag: true
  });
};

// Honeypot check middleware
const honeypotCheck = (req, res, next) => {
  const honeypotField = req.body.website_url;
  if (honeypotField && honeypotField.length > 0) {
    // Bot detected - silently return success to confuse bot
    return res.json({
      success: true,
      message: 'Thank you! We will be in touch soon.'
    });
  }
  next();
};

// Contact form handler
app.post('/api/contact', rateLimitMiddleware, honeypotCheck, async (req, res) => {
  try {
    // Extract and sanitize inputs
    const name = sanitizeInput(req.body.name);
    const email = sanitizeInput(req.body.email);
    const phone = sanitizeInput(req.body.phone);
    const subject = sanitizeInput(req.body.subject);
    const message = sanitizeInput(req.body.message);

    // Server-side validation
    const errors = [];

    if (!name) {
      errors.push('Name is required');
    } else if (!validateName(name)) {
      errors.push('Name must be 2-100 characters and contain only letters, spaces, hyphens, and apostrophes');
    }

    if (!email) {
      errors.push('Email is required');
    } else if (!validateEmail(email)) {
      errors.push('Please provide a valid email address');
    }

    if (phone && !validatePhoneNumber(phone)) {
      errors.push('Phone number must be at least 10 digits');
    }

    if (!subject) {
      errors.push('Subject is required');
    } else if (subject.length < 3 || subject.length > 200) {
      errors.push('Subject must be 3-200 characters');
    }

    if (!message) {
      errors.push('Message is required');
    } else if (!validateMessage(message)) {
      errors.push('Message must be 10-5000 characters');
    }

    // Return validation errors
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }

    // Create email template
    const emailTemplate = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>New Contact Form Submission</h2>
          
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <h3>Message:</h3>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            This email was submitted from your contact form on ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `;

    // Send email to admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Form: ${subject}`,
      html: emailTemplate,
      replyTo: email
    };

    // Send confirmation email to user
    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'We received your message',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Thank you for contacting us!</h2>
            <p>Dear ${name},</p>
            <p>We have received your message and will get back to you as soon as possible.</p>
            <p>Your message details:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>Best regards,<br>Our Team</p>
          </body>
        </html>
      `
    };

    // Send both emails
    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    // Return success response
    res.json({
      success: true,
      message: 'Thank you for your message! We will be in touch soon.'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred while processing your request. Please try again later.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req,