// server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// ---------- Mongoose User Model ----------
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// ---------- JWT Authentication Middleware ----------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401); // No token

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403); // Invalid token
    req.user = { id: payload.sub, role: payload.role };
    next();
  });
}

// ---------- Route: Get User Account Data ----------
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  const requestedId = req.params.id;

  // Authorization: own data or admin
  if (req.user.id !== requestedId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const user = await User.findById(requestedId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Strip sensitive fields before responding
    const { passwordHash, __v, ...safeData } = user;
    res.json(safeData);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ---------- Server & DB Initialization ----------
const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection error:', err);
  });