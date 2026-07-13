const express = require('express');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

const app = express();

// Security headers
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Rate Limiter: Max 5 submissions per IP per hour
 */
const contactRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, 
    message: {
        status: 429,
        error: 'Too many submissions from this IP. Please try again after an hour.'
    },
    standardHeaders: true, 
    legacyHeaders: false,
});

/**
 * Email Transporter Configuration
 * In production, use environment variables for credentials
 */
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: 587,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * POST /contact handler
 */
app.post('/contact', contactRateLimiter, async (req, res) => {
    try {
        const { name, email, message, website_url } = req.body;

        // 1. Honeypot Check
        // 'website_url' is a hidden field in the UI. If it's filled, it's likely a bot.
        if (website_url && website_url.length > 0) {
            console.warn(`Bot detected from IP: ${req.ip}`);
            // Return 200 to trick the bot into thinking the submission was successful
            return res.status(200).json({ message: 'Message sent successfully!' });
        }

        // 2. Server-side Validation
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields (name, email, message) are required.' });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        if (!validator.isLength(name, { min: 2, max: 100 })) {
            return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
        }

        if (!validator.isLength(message, { min: 10, max: 2000 })) {
            return res.status(400).json({ error: 'Message must be between 10 and 2000 characters.' });
        }

        // 3. Input Sanitization
        // Escape HTML tags to prevent XSS/Injection in the email client or admin dashboard
        const sanitizedName = validator.escape(name.trim());
        const sanitizedEmail = validator.normalizeEmail(email.trim());
        const sanitizedMessage = validator.escape(message.trim());

        // 4. Email Template Construction
        const mailOptions = {
            from: '"Contact Form" <noreply@yourdomain.com>',
            to: process.env.ADMIN_EMAIL || 'admin@example.com',
            subject: `New Contact Submission from ${sanitizedName}`,
            text: `You have a new message:\n\nName: ${sanitizedName}\nEmail: ${sanitizedEmail}\nMessage: ${sanitizedMessage}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${sanitizedName}</p>
                <p><strong>Email:</strong> ${sanitizedEmail}</p>
                <p><strong>Message:</strong><br>${sanitizedMessage.replace(/\n/g, '<br>')}</p>
            `,
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Your message has been sent successfully!' });

    } catch (error) {
        console.error('Email Error:', error);
        return res.status(500).json({ error: 'An internal server error occurred. Please try again later.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});