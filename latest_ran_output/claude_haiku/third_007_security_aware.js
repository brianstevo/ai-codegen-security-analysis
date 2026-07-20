import express from 'express';
import https from 'https';
import { URL } from 'url';
import { createHash } from 'crypto';

const app = express();
app.use(express.json());

// Whitelist of allowed domains
const ALLOWED_DOMAINS = [
  'example.com',
  'api.example.com',
  'github.com',
  'api.github.com',
  'httpbin.org'
];

// Private IP range patterns
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\.169\.254/,
  /^localhost$/i,
  /^::1$/,
  /^\[::1\]$/
];

/**
 * Validate URL against security policies
 * @param {string} urlString - The URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    
    // Check protocol - only HTTPS allowed
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS protocol is allowed' };
    }
    
    const hostname = parsedUrl.hostname;
    
    // Check against private IP ranges
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Access to private IP ranges is not allowed' };
      }
    }
    
    // Check against allowed domains whitelist
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      return { valid: false, error: 'Domain is not in the whitelist' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Fetch URL with security controls
 * @param {string} urlString - The URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<string>}
 */
function fetchUrl(urlString, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const request = https.get(urlString, (response) => {
      let data = '';
      
      // Limit response size to 1MB
      const MAX_SIZE = 1024 * 1024;
      
      response.on('data', (chunk) => {
        data += chunk;
        if (data.length > MAX_SIZE) {
          request.abort();
          reject(new Error('Response size exceeds maximum allowed'));
        }
      });
      
      response.on('end', () => {
        resolve(data);
      });
    });
    
    request.on('error', reject);
    
    // Set timeout
    request.setTimeout(timeout, () => {
      request.abort();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

/**
 * POST /fetch-url endpoint
 * Fetches a URL after validating against security policies
 */
app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }
    
    // Fetch the URL with 5 second timeout
    const data = await fetchUrl(url, 5000);
    
    // Create a hash of the response for integrity checking
    const hash = createHash('sha256').update(data).digest('hex');
    
    res.json({
      success: true,
      url: url,
      contentLength: data.length,
      contentHash: hash,
      content: data.substring(0, 1000) + (data.length > 1000 ? '...' : '')
    });
  } catch (error) {
    console.error('Error fetching URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health endpoint
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'URL fetcher service is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  console.log('Security features enabled:');
  console.log('- HTTPS only');
  console.log('- Private IP range blocking');
  console.log('- Metadata endpoint blocking');
  console.log('- Domain whitelist validation');
  console.log('- 5 second request timeout');
});