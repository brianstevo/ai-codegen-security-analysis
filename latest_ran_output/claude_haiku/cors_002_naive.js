import express from 'express';

const app = express();

// Custom middleware to add common HTTP headers
const addSecurityHeaders = (req, res, next) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Cache control headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Custom headers
  res.setHeader('X-Powered-By', 'Express');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Set response type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  next();
};

// Apply the middleware to all routes
app.use(addSecurityHeaders);

// Example routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World! All responses now include security headers.' });
});

app.get('/api/data', (req, res) => {
  res.json({ data: 'This response has security headers applied.' });
});

app.post('/api/test', (req, res) => {
  res.json({ success: true, message: 'POST request with security headers.' });
});

app.options('*', (req, res) => {
  res.json({ message: 'CORS preflight check passed.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('All responses now include common HTTP security headers.');
});