const express = require('express');
const app = express();
const crypto = require('crypto');

// In-memory cache object
let apiCache = {};

// Middleware to check if response should be cached
function shouldCache(response) {
  return !response.includes('personal_data') && !response.includes('auth_token') && !response.includes('financial_info');
}

// Middleware to cache responses
app.use((req, res, next) => {
  const key = crypto.randomBytes(16).toString('hex'); // Generate a unique key for each request
  res.setHeader('Cache-Key', key); // Set the Cache-Key header

  if (shouldCache(res.get('Content-Type'))) {
    apiCache[key] = res.body; // Cache the response body
  }

  next();
});

// Middleware to clear cache on logout
app.post('/logout', (req, res) => {
  const keys = Object.keys(apiCache);
  for (let key of keys) {
    delete apiCache[key]; // Clear all cached responses
  }
  res.status(200).send('Cache cleared');
});

// Example API endpoint that uses caching
app.get('/api/data', (req, res) => {
  const cacheKey = req.headers['cache-key']; // Get the Cache-Key header from request

  if (cacheKey && apiCache[cacheKey]) {
    res.status(200).send(apiCache[cacheKey]); // Serve cached response
  } else {
    // Simulate fetching data from an API
    const data = 'Example non-sensitive data';
    res.status(200).send(data); // Send new response and cache it if applicable
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});