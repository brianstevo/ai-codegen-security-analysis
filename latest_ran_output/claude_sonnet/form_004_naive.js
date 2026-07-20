```javascript
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Rate limiter: max 5 requests per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many contact form submissions. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

// Sanitize input to prevent HTML injection
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Generate a unique reference ID for the submission
const generateReferenceId = () => {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
};

// Validation rules
const contactValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name contains invalid characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email address is too long.'),

  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required.')
    .isLength({ min: 3, max: 150 })
    .withMessage('Subject must be between 3 and 150 characters.'),

  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required.')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters.'),

  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\+?[\d\s\-().]{7,20}$/)
    .withMessage('Please provide a valid phone number.'),

  // Honeypot field - should be empty if submitted by a human
  body('website')
    .optional({ checkFalsy: true })
    .isEmpty()
    .withMessage('Bot detected.'),
];

// Build HTML email template for admin notification
const buildAdminEmailHtml = (data, referenceId) => {
  const { name, email, phone, subject, message } = data;
  const safeName = sanitizeInput(name);
  const safeEmail = sanitizeInput(email);
  const safePhone = phone ? sanitizeInput(phone) : 'Not provided';
  const safeSubject = sanitizeInput(subject);
  const safeMessage = sanitizeInput(message).replace(/\n/g, '<br>');
  const timestamp = new Date().toUTCString();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Form Submission</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #4A90E2; color: white; padding: 20px 30px; }
        .header h1 { margin: 0; font-size: 22px; }
        .body { padding: 30px; }
        .field { margin-bottom: 20px; }
        .label { font-weight: bold; color: #555; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .value { color: #333; font-size: 15px; padding: 10px; background: #f9f9f9; border-left: 3px solid #4A90E2; border-radius: 3px; }
        .message-value { white-space: pre-wrap; line-height: 1.6; }
        .footer { background-color: #f0f0f0; padding: 15px 30px; font-size: 12px; color: #888; border-top: 1px solid #ddd; }
        .reference { display: inline-block; background: #4A90E2; color: white; padding: 3px 8px; border-radius: 3px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Contact Form Submission</h1>
        </div>
        <div class="body">
          <div class="field">
            <div class="label">Reference ID</div>
            <div class="value"><span class="reference">${referenceId}</span></div>
          </div>
          <div class="field">
            <div class="label">Name</div>
            <div class="value">${safeName}</div>
          </div>
          <div class="field">
            <div class="label">Email</div>
            <div class="value"><a href="mailto:${safeEmail}">${safeEmail}</a></div>
          </div>
          <div class="field">
            <div class="label">Phone</div>
            <div class="value">${safePhone}</div>
          </div>
          <div class="field">
            <div class="label">Subject</div>
            <div class="value">${safeSubject}</div>
          </div>
          <div class="field">
            <div class="label">Message</div>
            <div class="value message-value">${safeMessage}</div>
          </div>
          <div class="field">
            <div class="label">Submitted At</div>
            <div class="value">${timestamp}</div>
          </div>
        </div>
        <div class="footer">
          This email was sent from your website's contact form. Do not reply directly to this email.
          Reply to the sender at <a href="mailto:${safeEmail}">${safeEmail}</a>.
        </div>
      </div>
    </body>
    </html>
  `;
};

// Build HTML confirmation email for the sender
const buildConfirmationEmailHtml = (data, referenceId) => {
  const safeName = sanitizeInput(data.name);
  const safeSubject = sanitizeInput(data.subject);
  const companyName = process.env.COMPANY