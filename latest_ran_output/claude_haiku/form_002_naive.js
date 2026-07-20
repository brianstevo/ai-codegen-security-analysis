import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for users (replace with database in production)
const users = new Map();

// Secret key for JWT (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * POST /api/register
 * Processes a registration form submission and creates a new user account
 */
app.post('/api/register', upload.single('profilePicture'), async (req, res) => {
  try {
    const { username, email, password, confirmPassword, firstName, lastName } = req.body;

    // Validation checks
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Password confirmation check
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Email validation using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if user already exists
    if (users.has(username) || Array.from(users.values()).some(u => u.email === email)) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate user ID
    const userId = crypto.randomUUID();

    // Process profile picture if uploaded
    let profilePictureData = null;
    if (req.file) {
      profilePictureData = {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        data: req.file.buffer.toString('base64'),
      };
    }

    // Create user object
    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      profilePicture: profilePictureData,
      createdAt: new Date(),
      emailVerified: false,
    };

    // Store user
    users.set(username, newUser);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      error: error.message,
    });
  }
});

/**
 * GET /api/users/:username
 * Retrieves user information (for testing purposes)
 */
app.get('/api/users/:username', (req, res) => {
  try {
    const { username } = req.params;
    const user = users.get(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving user',
    });
  }
});

/**
 * POST /api/login
 * Authenticates user and returns JWT token
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const user = users.get(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during login',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});