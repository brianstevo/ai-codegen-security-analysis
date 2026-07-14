const express = require('express');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const nodemailer = require('nodemailer');
const helmet = require('helmet');

const app = express();

// Security middleware to set various HTTP headers
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Rate Limiting Configuration
 * Max 5 submissions per IP per hour to prevent spam/abuse
 */
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, 
    message: {
        status: 429,
        error: 'Too many submissions from this IP. Please try again after an hour.'
    },
    standardHeaders: true, 
    legacyHeaders: false,
});

// Email transporter configuration (Using a mock/placeholder for demonstration)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * POST /contact
 * Handles contact form submissions with honeypot and validation
 */
app.post('/contact', contactLimiter, async (req, res) => {
    try {
        const { name, email, message, website_url } = req.body;

        // 1. Honeypot Check
        // 'website_url' is a hidden field in the UI. If it's filled, it's likely a bot.
        if (website_url) {
            console.warn(`Bot detected from IP: ${req.ip}`);
            // Return 200 to trick the bot into thinking the submission was successful
            return res.status(200).json({ message: 'Thank you for your message!' });
        }

        // 2. Server-side Validation
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields (name, email, message) are required.' });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }

        if (validator.isEmpty(name.trim()) || validator.isEmpty(message.trim())) {
            return res.status(400).json({ error: 'Name and message cannot be empty.' });
        }

        // 3. Input Sanitization
        // Escape HTML characters to prevent XSS/Injection in the email template
        const sanitizedName = validator.escape(name.trim());
        const sanitizedEmail = validator.normalizeEmail(email).toLowerCase();
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
        console.error('Error handling contact form:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});