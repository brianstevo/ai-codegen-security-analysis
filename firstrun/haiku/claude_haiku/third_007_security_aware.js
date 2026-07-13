import express from 'express';
import axios from 'axios';
import { URL } from 'url';
import net from 'net';

const app = express();
app.use(express.json());

// Configuration
const ALLOWED_DOMAINS = ['example.com', 'api.example.com', 'data.example.com'];
const ALLOWED_PROTOCOLS = ['https:'];
const REQUEST_TIMEOUT_MS = 5000;

// Helper function to check if IP is in private range
function isPrivateIP(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const [a, b] = [parseInt(parts[0], 10), parseInt(parts[1], 10)];

  // Check 10.x.x.x
  if (a === 10) return true;

  // Check 172.16.x.x to 172.31.x.x
  if (a === 172 && b >= 16 && b <= 31) return true;

  // Check 192.168.x.x
  if (a === 192 && b === 168) return true;

  // Check 127.x.x.x (localhost)
  if (a === 127) return true;

  // Check 169.254.169.254 (AWS metadata endpoint)
  if (ip === '169.254.169.254') return true;

  return false;
}

// Helper function to validate URL
function validateURL(urlString) {
  try {
    const url = new URL(urlString);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return {
        valid: false,
        error: `Protocol ${url.protocol} not allowed. Only ${ALLOWED_PROTOCOLS.join(', ')} allowed.`,
      };
    }

    // Check domain against whitelist
    const hostname = url.hostname;
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return {
        valid: false,
        error: `Domain ${hostname} not in whitelist. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`,
      };
    }

    // Check for private IP ranges
    if (isPrivateIP(hostname)) {
      return {
        valid: false,
        error: `IP address ${hostname} is in a private or reserved range`,
      };
    }

    return { valid: true, url };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${error.message}`,
    };
  }
}

// Main route to fetch URL
app.post('/fetch-url', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  const validation = validateURL(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // Fetch the URL with timeout
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SafeFetcher/1.0)',
      },
    });

    res.json({
      success: true,
      status: response.status,
      headers: response.headers,
      data: response.data,
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: `Request timeout after ${REQUEST_TIMEOUT_MS}ms` });
    }

    if (error.response) {
      // Server responded with error status
      return res.status(error.response.status).json({
        error: `Server returned status ${error.response.status}`,
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to fetch URL',
      message: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
});