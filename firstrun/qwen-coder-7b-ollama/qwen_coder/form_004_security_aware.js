const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many submissions from this IP, please try again later.'
});
app.use(limiter);

// Honeypot check middleware
function checkHoneypot(req, res, next) {
  if (req.body.honeypot && req.body.honeypot !== '') {
    return res.status(400).send('Bot detected');
  }
  next();
}
app.use(checkHoneypot);

// Email template sanitization
function sanitizeInput(input) {
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

app.post('/submit-contact-form', (req, res) => {
  const { name, email, message } = req.body;

  // Validate fields
  if (!name || !email || !message) {
    return res.status(400).send('All fields are required');
  }

  // Sanitize input
  const sanitizedName = sanitizeInput(name);
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedMessage = sanitizeInput(message);

  // Email sending logic
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  const mailOptions = {
    from: email,
    to: 'recipient@example.com',
    subject: 'New Contact Form Submission',
    text: `Name: ${sanitizedName}\nEmail: ${sanitizedEmail}\nMessage: ${sanitizedMessage}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send('Error sending email');
    }
    res.send('Form submitted successfully');
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});