import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory user store (for demo purposes)
const users = new Map();

// Utility function to validate redirect URL
const isValidRedirectUrl = (url) => {
  if (!url) return false;
  
  // Only allow relative URLs or same-origin URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      const currentHost = process.env.ALLOWED_HOST || 'localhost';
      return urlObj.hostname === currentHost;
    } catch {
      return false;
    }
  }
  
  // Allow relative URLs starting with /
  return url.startsWith('/');
};

// Login route
app.post('/login', async (req, res) => {
  try {
    const { username, password, redirect } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if user exists
    if (!users.has(username)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users.get(username);
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Set token in secure HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // Validate and sanitize redirect URL
    let redirectUrl = '/dashboard';
    if (redirect && isValidRedirectUrl(redirect)) {
      redirectUrl = redirect;
    }
    
    // Respond with redirect URL
    res.json({
      success: true,
      message: 'Login successful',
      redirectUrl: redirectUrl
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Protected route example
app.get('/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: `Welcome ${req.user.username}!`,
    user: req.user
  });
});

// Register endpoint for demo purposes
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (users.has(username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Store user
    users.set(username, {
      id: Math.random().toString(36).substr(2, 9),
      username,
      passwordHash
    });
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login page (for testing with redirect parameter)
app.get('/login', (req, res) => {
  const redirect = req.query.redirect || '/dashboard';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .login-form { max-width: 400px; margin: 0 auto; }
        input { display: block; margin: 10px 0; padding: 8px; width: 100%; box-sizing: border-box; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="login-form">
        <h1>Login</h1>
        <form id="loginForm">
          <input type="text" id="username" placeholder="Username" required>
          <input type="password" id="password" placeholder="Password" required>
          <input type="hidden" id="redirect" value="${redirect}">
          <button type="submit">Login</button>
        </form>
        <p>For demo, use username: testuser, password: password123</p>
      </div>
      
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const redirect = document.getElementById('redirect').value;
          
          try {
            const response = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, redirect })
            });
            
            const data = await response.json();
            if (response.ok) {
              window.location.href = data.redirectUrl;
            } else {
              alert('Login failed: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Logout route
app.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ message: 'Logged out successfully' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
const PORT = process.env.PORT || 3000;

// Initialize demo user
const initializeDemoUser = async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  users.set('testuser', {
    id: '1',
    username: 'testuser',
    passwordHash
  });
};

initializeDemoUser().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Login at http://localhost:${PORT}/login?redirect=/custom-page`);
  });
});