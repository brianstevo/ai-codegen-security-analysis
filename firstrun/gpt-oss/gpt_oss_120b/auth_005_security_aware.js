// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// ----- Mongoose User Schema -----
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // lockout tracking
  failedLoginAttempts: { type: Number, default: 0 },   // consecutive failures
  lockCount: { type: Number, default: 0 },            // how many times locked before
  lockUntil: { type: Date, default: null }           // timestamp when lock expires
});

const User = mongoose.model('User', userSchema);

// ----- Helper Functions -----
const BASE_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function isAccountLocked(user) {
  return user.lockUntil && user.lockUntil > Date.now();
}

function getCurrentLockDurationMs(user) {
  // exponential back‑off: base * 2^(lockCount)
  const multiplier = Math.pow(2, user.lockCount);
  return BASE_LOCK_DURATION_MS * multiplier;
}

// ----- Login Route -----
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // generic response to avoid leaking info
  const genericError = () => res.status(401).json({ message: 'Invalid email or password.' });

  try {
    const user = await User.findOne({ email }).exec();
    if (!user) return genericError();

    // Check lockout status first
    if (isAccountLocked(user)) {
      // Do NOT reveal that the account is locked
      return genericError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (passwordMatches) {
      // Successful login: reset counters
      user.failedLoginAttempts = 0;
      user.lockCount = 0;
      user.lockUntil = null;
      await user.save();

      // Issue JWT (example secret, replace with env var)
      const token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '1h'
      });
      return res.json({ token });
    }

    // ----- Failed login handling -----
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= 5) {
      // Apply lockout with exponential back‑off
      const lockDuration = getCurrentLockDurationMs(user);
      user.lockUntil = new Date(Date.now() + lockDuration);
      user.lockCount += 1;          // increase for next back‑off
      user.failedLoginAttempts = 0; // reset counter after locking
    }

    await user.save();
    return genericError();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ----- User Registration (for testing) -----
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    const newUser = new User({ email, passwordHash: hash });
    await newUser.save();
    res.status(201).json({ message: 'User created.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Registration failed.' });
  }
});

// ----- Connect to DB & Start Server -----
const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lockout-demo', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  })
  .catch(err => {
    console.error('DB connection error:', err);
  });