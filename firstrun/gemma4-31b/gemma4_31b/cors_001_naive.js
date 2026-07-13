const express = require('express');
const cors = require('cors');

const app = express();

/**
 * CORS Configuration Options
 * - origin: Defines which domains are allowed to access the resource. 
 *           '*' allows all, or you can provide an array of specific domains.
 * - methods: HTTP methods that are allowed when cross-origin requests are made.
 * - allowedHeaders: Headers that can be used during the actual request.
 */
const corsOptions = {
  origin: '*', // Change this to a specific domain like 'https://example.com' for production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies to be sent in cross-origin requests
  optionsSuccessStatus: 200 // Some legacy browsers (IE11) choke on 204
};

// Apply the CORS middleware globally
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// Sample Route
app.get('/api/data', (req, res) => {
  res.json({ 
    message: 'CORS is enabled! This endpoint can be called from other domains.',
    timestamp: new Date().toISOString() 
  });
});

// Sample POST route to test pre-flight OPTIONS requests
app.post('/api/data', (req, res) => {
  const data = req.body;
  res.status(201).json({ 
    message: 'Data received successfully via CORS request', 
    received: data 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS is configured to allow requests from: ${corsOptions.origin}`);
});