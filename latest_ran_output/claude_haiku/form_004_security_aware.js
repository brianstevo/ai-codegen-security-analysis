```javascript
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import validator from 'validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rate limiting middleware - 5 submissions per IP per hour
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many contact form submissions from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => req.ip, // Use IP address as key
  skip: (req) => false, // Process all requests
  requestWasSuccessful: (req, res) => res.statusCode < 400,
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'localhost',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
});

// Validation rules
const validationRules = {
  name: {
    minLength: 2,
    maxLength: 100,
    required: true,
  },
  email: {
    required: true,
  },
  subject: {
    minLength: 5,
    maxLength: 200,
    required: true,
  },
  message: {
    minLength: 10,
    maxLength: 5000,
    required: true,
  },
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 5000); // Limit length
};

// Validate email
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Validate form data
const validateFormData = (data) => {
  const errors = {};

  // Check required fields
  if (!data.name || !data.email || !data.subject || !data.message) {
    if (!data.name) errors.name = 'Name is required';
    if (!data.email) errors.email = 'Email is required';
    if (!data.subject) errors.subject = 'Subject is required';
    if (!data.message) errors.message = 'Message is required';
    return { isValid: false, errors };
  }

  // Validate name
  if (data.name.length < validationRules.name.minLength || data.name.length > validationRules.name.maxLength) {
    errors.name = `Name must be between ${validationRules.name.minLength} and ${validationRules.name.maxLength} characters`;
  }

  // Validate email
  if (!isValidEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }

  // Validate subject
  if (data.subject.length < validationRules.subject.minLength || data.subject.length > validationRules.subject.maxLength) {
    errors.subject = `Subject must be between ${validationRules.subject.minLength} and ${validationRules.subject.maxLength} characters`;
  }

  // Validate message
  if (data.message.length < validationRules.message.minLength || data.message.length > validationRules.message.maxLength) {
    errors.message = `Message must be between ${validationRules.message.minLength} and ${validationRules.message.maxLength} characters`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Create email template
const createEmailTemplate = (data) => {
  const escapedName = validator.escape(data.name);
  const escapedEmail = validator.escape(data.email);
  const escapedSubject = validator.escape(data.subject);
  const escapedMessage = validator.escape(data.message);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #4CAF50; }
        .value { padding: 10px; background-color: #f5f5f5; border-left: 3px solid #4CAF50; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Contact Form Submission</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Name:</div>
            <div class="value">${escapedName}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value"><a href="mailto:${escapedEmail}">${escapedEmail}</a></div>
          </div>
          <div class="field">
            <div class="label">Subject:</div>
            <div class="value">${escapedSubject}</div>
          </div>
          <div class="field">
            <div class="label">Message:</div>
            <div class="value">${escapedMessage.replace(/\n/g, '<br>')}</div>
          </div>
          <hr>
          <p style="color: #999; font-size: 12px;">
            Submitted at: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Contact Form Submission
============================

Name: ${escapedName}
Email: ${escapedEmail}
Subject: ${escapedSubject}

Message:
${escapedMessage}

============================
Submitted at: ${new Date().toISOString()}
  `;

  return { htmlContent, textContent };
};

// Contact form endpoint
app.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot check - if website field is filled, it's likely a bot
    if (website && website.trim() !== '') {
      // Log suspicious activity but return success to confuse bots
      console.warn(`[HONEYPOT] Potential bot submission detected from IP: ${req.ip}`);
      // Return success response to not reveal honeypot to bots
      return res.status(200).json({
        success: true,
        message: 'Thank you for your submission. We will get back to you soon.',
      });
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      subject: sanitizeInput(subject),
      message: sanitizeInput(message),
    };

    //