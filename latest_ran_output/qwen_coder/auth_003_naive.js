const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Mock database for demonstration purposes
let users = [];

// Create a transporter object using SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Replace with your email
        pass: 'your-password' // Replace with your password
    }
});

app.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    // Find the user by email
    let user = users.find(u => u.email === email);
    if (!user) return res.status(404).send('User not found');

    // Generate a reset token
    let resetToken = crypto.randomBytes(20).toString('hex');
    let resetTokenHash = await bcrypt.hash(resetToken, 10);

    // Save the reset token and its expiration time in the user's data
    user.resetToken = resetTokenHash;
    user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour

    // Send an email with the reset link
    let mailOptions = {
        from: 'your-email@gmail.com', // Replace with your email
        to: email,
        subject: 'Password Reset Request',
        text: `You are receiving this because you (or someone else) have requested the password reset for your account.\n\nPlease click on the following link, or paste it into your browser to complete the process:\n\nhttp://localhost:3000/reset?token=${resetToken}\n\nIf you did not request a password reset, please ignore this email and your password will remain unchanged.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) return res.status(500).send('Error sending email');
        res.send('Password reset link sent to your email');
    });
});

app.listen(3000, () => console.log('Server started on port 3000'));