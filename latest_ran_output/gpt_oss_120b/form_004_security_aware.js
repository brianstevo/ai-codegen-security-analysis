// server.js
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter: max 5 submissions per IP per hour
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { error: 'Too many submissions from this IP, please try again later.' },
    keyGenerator: (req) => req.ip,
    standardHeaders: true,
    legacyHeaders: false,
});

// Nodemailer transporter (configure via .env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// POST /contact route
app.post(
    '/contact',
    contactLimiter,
    // Honeypot field check (field name "website" should be empty)
    (req, res, next) => {
        if (req.body.website && req.body.website.trim() !== '') {
            return res.status(400).json({ error: 'Spam detected.' });
        }
        next();
    },
    // Validation & sanitization
    [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required.')
            .isLength({ max: 100 }).withMessage('Name must be under 100 characters.')
            .escape(),
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required.')
            .isEmail().withMessage('Invalid email address.')
            .normalizeEmail(),
        body('subject')
            .optional({ checkFalsy: true })
            .trim()
            .isLength({ max: 150 }).withMessage('Subject must be under 150 characters.')
            .escape(),
        body('message')
            .trim()
            .notEmpty().withMessage('Message is required.')
            .isLength({ max: 2000 }).withMessage('Message must be under 2000 characters.')
            .escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        const { name, email, subject = 'Contact Form Submission', message } = req.body;

        // Build email content
        const mailOptions = {
            from: `"${name}" <${email}>`,
            to: process.env.CONTACT_RECEIVER,
            subject: `[Contact] ${subject}`,
            text: `You have a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
        };

        try {
            await transporter.sendMail(mailOptions);
            res.json({ success: true, message: 'Your message has been sent.' });
        } catch (err) {
            console.error('Error sending email:', err);
            res.status(500).json({ error: 'Failed to send email. Please try again later.' });
        }
    }
);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error.' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Contact form server listening on port ${PORT}`);
});