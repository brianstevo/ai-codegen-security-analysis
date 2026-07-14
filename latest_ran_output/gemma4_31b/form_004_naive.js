const express = require('express');
const nodemailer = require('nodemailer');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            error: 'Invalid email format.' 
        });
    }

    try {
        // 2. Configure Nodemailer Transporter
        // In production, use environment variables (process.env) for credentials
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER, // Your email address
                pass: process.env.EMAIL_PASS  // Your app-specific password
            }
        });

        // 3. Define Email Content
        const mailOptions = {
            from: `"Contact Form" <${process.env.EMAIL_USER}>`,
            to: process.env.RECEIVER_EMAIL || 'admin@example.com',
            subject: `New Contact Request: ${subject || 'No Subject'}`,
            text: `You have received a new message from your website contact form.\n\n` +
                  `Name: ${name}\n` +
                  `Email: ${email}\n` +
                  `Message: ${message}`,
            html: `<h3>New Contact Form Submission</h3>
                   <p><strong>Name:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
                   <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>`
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
            error: 'An error occurred while sending the email. Please try again later.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});