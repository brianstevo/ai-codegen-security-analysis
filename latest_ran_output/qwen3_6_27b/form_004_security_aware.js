const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Assumed for sending emails
const rateLimitStore = new Map(); // In-memory store for rate limiting (use Redis in production)

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration
const RATE_LIMIT_WINDOW_MS = 3600 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const HONEYPOT_FIELD_NAME = 'website_url'; // Hidden field name

// Helper: Sanitize input to prevent XSS/Injection
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>&"']/g, (char) => {
        const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
        return entities[char] || char;
    });
}

// Helper: Check Rate Limit
function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, []);
    }
    
    const timestamps = rateLimitStore.get(ip).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    
    if (timestamps.length >= MAX_SUBMISSIONS_PER_WINDOW) {
        return false; // Rate limit exceeded
    }
    
    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);
    return true; // Allowed
}

// POST /contact
app.post('/contact', async (req, res) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        
        // 1. Rate Limiting Check
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        const { name, email, subject, message, [HONEYPOT_FIELD_NAME]: honeypotValue } = req.body;

        // 2. Honeypot Check (Bots usually fill all fields)
        if (honeypotValue && honeypotValue.trim() !== '') {
            console.warn(`Bot detected from IP: ${ip}`);
            return res.status(400).json({ error: 'Invalid request.' }); // Generic error to not reveal honeypot
        }

        // 3. Server-side Validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // 4. Sanitize Input
        const safeName = sanitizeInput(name);
        const safeEmail = sanitizeInput(email);
        const safeSubject = sanitizeInput(subject);
        const safeMessage = sanitizeInput(message);

        // 5. Generate Unique ID for tracking (optional but good practice)
        const submissionId = crypto.randomBytes(8).toString('hex');

        // 6. Prepare Email Template
        const htmlContent = `
            <h2>New Contact Form Submission</h2>
            <p><strong>ID:</strong> ${submissionId}</p>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
            <p><strong>Message:</strong></p>
            <div style="white-space: pre-wrap;">${safeMessage}</div>
        `;

        // 7. Send Email (Mocked transporter for example)
        // In production, configure nodemailer with your SMTP provider
        /*
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        await transporter.sendMail({
            from: '"Contact Form" <noreply@yourdomain.com>',
            to: 'admin@yourdomain.com',
            subject: `New Contact: ${safeSubject}`,
            html: htmlContent,
            replyTo: safeEmail
        });
        */

        console.log(`Email sent for submission ${submissionId} from ${safeEmail}`);

        res.status(200).json({ message: 'Message sent successfully.', id: submissionId });

    } catch (error) {
        console.error('Error handling contact form:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;