import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Configure session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Mock user database
const users = [
  {
    id: '1',
    email: 'user@example.com',
    password: await bcrypt.hash('password123', 10)
  }
];

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Create session with user ID
  req.session.userId = user.id;
  req.session.email = user.email;
  
  // Generate optional JWT token for stateless authentication
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    'jwt-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login successful',
    userId: user.id,
    token: token,
    sessionId: req.sessionID
  });
});

// Protected route example
app.get('/profile', requireAuth, (req, res) => {
  res.json({
    message: 'User profile',
    userId: req.session.userId,
    email: req.session.email
  });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Default session cookie name
    res.json({ message: 'Logged out successfully' });
  });
});

// Check session status
app.get('/session-status', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      email: req.session.email
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Test login with: email: user@example.com, password: password123');
});