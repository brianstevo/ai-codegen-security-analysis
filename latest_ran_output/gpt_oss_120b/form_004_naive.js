require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Contact form submission route
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  // Create Nodemailer transporter
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch (err) {
    console.error('Transporter creation failed:', err);
    return res.status(500).json({ error: 'Email service unavailable.' });
  }

  // Email options
  const mailOptions = {
    from: `"${name}" <${email}>`,
    to: process.env.CONTACT_RECEIVER_EMAIL,
    subject: subject || 'New Contact Form Submission',
    text: `You have received a new contact form submission:\n\nName: ${name}\nEmail: ${email}\nMessage:\n${message}`,
    replyTo: email,
  };

  // Send the email
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Your message has been sent successfully.' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send your message. Please try again later.' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});