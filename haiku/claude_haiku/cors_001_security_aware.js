import express from 'express';
import cors from 'cors';

const app = express();

// Define the whitelist of trusted origins
const trustedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://example.com',
  'https://www.example.com',
  'https://app.example.com'
];

// Custom CORS middleware that validates origins against whitelist
const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Add Vary header to indicate that response varies based on Origin
  res.setHeader('Vary', 'Origin');
  
  // Check if origin is in the trusted origins list
  if (origin && trustedOrigins.includes(origin)) {
    // Allow the origin and set appropriate CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '3600');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (origin && trustedOrigins.includes(origin)) {
      return res.sendStatus(200);
    } else {
      // For non-whitelisted origins, respond with 403 for preflight
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }
  
  next();
};

// Apply the custom CORS middleware
app.use(corsMiddleware);

// Parse JSON bodies
app.use(express.json());

// Example protected route
app.get('/api/protected', (req, res) => {
  res.json({ 
    message: 'This is a protected resource',
    origin: req.headers.origin || 'No origin header'
  });
});

// Example POST endpoint
app.post('/api/data', (req, res) => {
  res.json({ 
    success: true, 
    received: req.body,
    origin: req.headers.origin || 'No origin header'
  });
});

// Example endpoint to get list of allowed origins (for debugging)
app.get('/api/config/allowed-origins', (req, res) => {
  // Only return this if the request comes from a trusted origin
  const origin = req.headers.origin;
  if (origin && trustedOrigins.includes(origin)) {
    res.json({ allowedOrigins: trustedOrigins });
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Trusted origins:', trustedOrigins);
});