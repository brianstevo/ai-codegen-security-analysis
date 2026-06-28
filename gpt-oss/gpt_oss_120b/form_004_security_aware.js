// contact-server.js
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter: max 5 submissions per IP per hour
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        status: 'error',
        error: 'Too many submissions from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation & sanitisation chain
const contactValidation = [
    // Honeypot field (should be empty)
    body('hp_field').custom(value => {
        if (value && value.trim() !== '') {
            throw new Error('Bot detected.');
        }
        return true;
    }),

    // Name: required, trim, escape
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required.')
        .isLength({ max: 100 }).withMessage('Name too long.'),

    // Email: required, valid email format, normalize
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.')
        .normalizeEmail(),

    // Subject: optional but limit length
    body('subject')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 150 }).withMessage('Subject too long.'),

    // Message: required, trim, min length
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required.')
        .isLength({ min: 10 }).withMessage('Message too short.'),
];

// Nodemailer transporter (configure via env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// POST /contact endpoint
app.post('/contact', contactLimiter, contactValidation, async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    // Extract sanitized fields
    const { name, email, subject = 'Contact Form Submission', message } = req.body;

    // Additional sanitisation for HTML safety (strip any tags)
    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safeSubject = sanitizeHtml(subject, { allowedTags: [], allowedAttributes: {} });
    const safeMessage = sanitizeHtml(message, {
        allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        allowedAttributes: {
            a: ['href', 'title', 'target']
        },
        transformTags: {
            'script': () => ({ tagName: 'noscript' })
        }
    });

    // Build email content
    const mailOptions = {
        from: `"${safeName}" <${safeEmail}>`,
        to: process.env.CONTACT_RECIPIENT, // destination address
        subject: safeSubject,
        html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
            <hr/>
            <div>${safeMessage.replace(/\n/g, '<br/>')}</div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ status: 'success', message: 'Your message has been sent.' });
    } catch (err) {
        console.error('Email send error:', err);
        res.status(500).json({ status: 'error', error: 'Failed to send email. Please try again later.' });
    }
});

// Global error handler for unexpected errors
app.use((err, req, res, next) => {
    console.error('Unexpected error:', err);
    res.status(500).json({ status: 'error', error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Contact form server listening on port ${PORT}`);
});