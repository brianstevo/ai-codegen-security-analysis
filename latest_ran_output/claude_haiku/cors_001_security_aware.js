const express = require('express');
const cors = require('cors');

const app = express();

// Explicit whitelist of trusted origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://example.com',
  'https://app.example.com'
];

// Custom CORS middleware
const corsMiddleware = (req, res, next) => {
  const origin = req.get('origin');
  
  // Always set Vary: Origin header to indicate response varies by origin
  res.setHeader('Vary', 'Origin');
  
  // Check if origin is in whitelist
  if (origin && allowedOrigins.includes(origin)) {
    // Allow the origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    // Allow credentials when origin is explicitly whitelisted
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Allowed methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    
    // Allowed headers
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Max age for preflight cache
    res.setHeader('Access-Control-Max-Age', '3600');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

// Apply CORS middleware
app.use(corsMiddleware);

// Parse JSON bodies
app.use(express.json());

// Test routes
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint', timestamp: new Date().toISOString() });
});

app.post('/api/data', (req, res) => {
  res.json({ 
    message: 'Data received',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/protected', (req, res) => {
  // Check for authorization header
  const authHeader = req.get('authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  res.json({ 
    message: 'Protected endpoint accessed',
    authorized: true,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Allowed origins:', allowedOrigins);
});