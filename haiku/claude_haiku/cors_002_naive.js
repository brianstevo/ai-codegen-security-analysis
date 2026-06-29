import express from 'express';

const app = express();

// Middleware to add common HTTP headers to every response
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Cache control
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Additional headers
  res.setHeader('X-Powered-By', 'Express');
  res.setHeader('Content-Type', 'application/json');
  
  // Call next middleware
  next();
});

// Example routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.get('/api/test', (req, res) => {
  res.json({ data: 'This response includes all common HTTP headers' });
});

app.post('/api/data', (req, res) => {
  res.status(201).json({ success: true, id: 1 });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});