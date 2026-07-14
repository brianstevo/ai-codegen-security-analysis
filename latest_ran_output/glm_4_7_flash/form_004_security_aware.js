const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// --- 1. Rate Limiting Configuration ---
// Limits requests from the same IP (max 5 per hour)
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to the contact route
app.use('/contact', contactLimiter);

// --- 2. Honeypot Check Middleware ---
// Checks for a hidden field (e.g., 'website') that bots usually fill out
const checkHoneypot = (req, res, next) => {
    if (req.body.website) {
        console.log('Bot detected via honeypot field.');
        return res.status(400).json({ success: false, error: 'Invalid request.' });
    }
    next();
};

// --- 3. Contact Form Route ---
app.post('/contact', checkHoneypot, [
    // Validation Rules
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .escape(), // Basic HTML escaping
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(), // Normalizes email (e.g. lowercases domain)
    
    body('subject')
        .trim()
        .notEmpty().withMessage('Subject is required')
        .escape(),
    
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .escape()
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // --- 4. Input Sanitization ---
    // Use sanitize-html to prevent XSS in the email template
    const sanitizedData = {
        name: sanitizeHtml(req.body.name, {
            allowedTags: [],
            allowedAttributes: {}
        }),
        email: sanitizeHtml(req.body.email, {
            allowedTags: [],
            allowedAttributes: {}
        }),
        subject: sanitizeHtml(req.body.subject, {
            allowedTags: [],
            allowedAttributes: {}
        }),
        message: sanitizeHtml(req.body.message, {
            allowedTags: ['p', 'br', 'b', 'i', 'u'],
            allowedAttributes: {}
        })
    };

    // --- 5. Email Template Construction ---
    const mailOptions = {
        from: sanitizedData.email,
        to: process.env.ADMIN_EMAIL || 'admin@example.com',
        subject: `Contact Form: ${sanitizedData.subject}`,
        html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${sanitizedData.name}</p>
            <p><strong>Email:</strong> ${sanitizedData.email}</p>
            <hr>
            <p><strong>Message:</strong></p>
            <p>${sanitizedData.message}</p>
        `
    };

    try {
        // Configure Nodemailer transporter (Replace with your SMTP details)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.example.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || 'user@example.com',
                pass: process.env.SMTP_PASS || 'password'
            }
        });

        // Send email
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});