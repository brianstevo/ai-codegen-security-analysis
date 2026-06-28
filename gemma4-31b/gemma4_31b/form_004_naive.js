const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * POST /contact
 * Processes contact form submissions and sends an email notification.
 */
app.post('/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // 1. Basic Validation
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Please provide your name, email, and a message.' 
        });
    }

    // Simple regex for email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid email address format.' 
        });
    }

    try {
        // 2. Configure Nodemailer Transporter
        // In production, use environment variables for credentials (process.env.EMAIL_USER, etc.)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.mailtrap.io', 
            port: process.env.SMTP_PORT || 2525,
            auth: {
                user: process.env.SMTP_USER || 'your_username',
                pass: process.env.SMTP_PASS || 'your_password'
            }
        });

        // 3. Define Email Options
        const mailOptions = {
            from: `"Contact Form" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
            to: process.env.EMAIL_TO || 'admin@example.com', // Where the admin receives the contact request
            subject: `New Contact Request: ${subject || 'No Subject'}`,
            text: `You have a new message from your website contact form.\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
                <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        // 4. Send the Email
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ 
            success: true, 
            message: 'Your message has been sent successfully!' 
        });

    } catch (error) {
        console.error('Email Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'An error occurred while sending your message. Please try again later.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});