const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const xss = require('xss-clean');

const app = express();

// Middleware
app.use(express.json());
app.use(xss()); // Sanitizes all input against XSS attacks

// Rate Limiting: Maximum 5 submissions per IP per hour
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip // Uses IP address for rate limiting
});

// Honeypot Middleware: Checks for a hidden field filled by bots
const checkHoneypot = (req, res, next) => {
    // Assuming the honeypot field is named 'website'
    if (req.body.website) {
        return res.status(400).json({ error: 'Invalid submission detected.' });
    }
    next();
};

// Contact Form Route
app.post('/contact', contactLimiter, checkHoneypot, (req, res) => {
    const { name, email, message } = req.body;

    // Server-side Validation
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Sanitization is handled by 'xss-clean' middleware above,
    // but we ensure we are using the sanitized data here.

    // Email Template Construction
    const mailOptions = {
        from: `"${name}" <${email}>`,
        to: process.env.CONTACT_EMAIL || 'admin@example.com',
        subject: `New Contact Form Submission from ${name}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0056b3;">New Message Received</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <hr style="border-color: #eee;">
                <p><strong>Message:</strong></p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 10px;">
                    ${message}
                </div>
            </div>
        `
    };

    // Nodemailer Transporter Setup (Configure with your SMTP details)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Send Email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ error: 'Failed to send message.' });
        }
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    });
});

// Start Server (Example)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});