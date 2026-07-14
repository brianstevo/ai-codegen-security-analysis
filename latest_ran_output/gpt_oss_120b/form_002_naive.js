// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

// ==== Config ====
const MONGO_URI = 'mongodb://localhost:27017/registration_demo';
const JWT_SECRET = 'your_jwt_secret_here'; // replace with env var in production
const PORT = process.env.PORT || 3000;

// ==== Connect to MongoDB ====
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ==== User Schema & Model ====
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ==== Express App Setup ====
const app = express();
app.use(bodyParser.json());

// ==== Registration Route ====
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already in use.' });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user document
        const newUser = new User({
            name,
            email,
            passwordHash
        });

        await newUser.save();

        // Generate JWT token
        const tokenPayload = { id: newUser._id, email: newUser.email };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        // Respond with user info (excluding password) and token
        res.status(201).json({
            message: 'Registration successful.',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt
            },
            token
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ==== Start Server ====
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});