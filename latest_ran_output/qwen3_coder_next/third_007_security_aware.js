const express = require('express');
const http = require('http');
const https = require('https');
const ipaddr = require('ipaddr.js');
const { URL } = require('url');

const router = express.Router();

// Private IP ranges to block
const PRIVATE_IP_RANGES = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8'
];

// Cloud metadata endpoints to block
const BLOCKED_IPS = ['169.254.169.254'];

// Allowed protocols (only https)
const ALLOWED_PROTOCOLS = ['https:'];

// Helper function to check if IP is private or blocked
function isPrivateOrBlockedIP(ip) {
  try {
    let addr = ipaddr.parse(ip);
    
    // Handle IPv6-mapped IPv4 addresses
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }
    
    // Check against blocked IPs list
    if (BLOCKED_IPS.includes(addr.toString())) {
      return true;
    }
    
    // Check against private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (addr.isInSubnet(ipaddr.parseCIDR(range))) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    // Invalid IP address format
    return true;
  }
}

// Helper function to validate URL
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Check protocol is allowed
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: 'Protocol not allowed. Only https is permitted.' };
    }
    
    // Extract hostname and resolve to IP addresses
    const host = url.hostname;
    
    // For domain names, we'll check against whitelist later
    // For IP addresses, validate immediately
    if (ipaddr.isValid(host)) {
      if (isPrivateOrBlockedIP(host)) {
        return { valid: false, error: 'Access to private or blocked IPs is forbidden.' };
      }
    }
    
    return { valid: true, url };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

// Helper function to resolve hostname and check IP addresses
function checkDnsResolution(hostname, callback) {
  const dns = require('dns');
  
  // Get all A records for the hostname
  dns.resolve4(hostname, (err, addresses) => {
    if (err) {
      return callback(err);
    }
    
    // Check each resolved IP address
    for (const addr of addresses) {
      if (isPrivateOrBlockedIP(addr)) {
        return callback(new Error('Resolved to private or blocked IP address'));
      }
    }
    
    callback(null, addresses);
  });
}

// Route handler
router.get('/fetch', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Validate URL format and protocol
  const validation = isValidUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  // Extract hostname for domain whitelist check (if implemented)
  const hostname = validation.url.hostname;
  
  // TODO: Implement domain whitelist check here
  // Example:
  // const allowedDomains = ['example.com', 'trusted.org'];
  // if (!allowedDomains.includes(hostname) && !allowedDomains.some(domain => hostname.endsWith('.' + domain))) {
  //   return res.status(403).json({ error: 'Domain not in whitelist' });
  // }
  
  // Resolve DNS and check IPs
  try {
    await new Promise((resolve, reject) => {
      checkDnsResolution(hostname, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    
    // Make the HTTP request with timeout
    const client = validation.url.protocol === 'https:' ? https : http;
    
    const request = client.request(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'SafeFetcher/1.0'
      }
    }, (response) => {
      // Handle response
      let data = '';
      
      response.on('data', chunk => {
        data += chunk;
      });
      
      response.on('end', () => {
        res.json({
          status: response.statusCode,
          headers: response.headers,
          body: data
        });
      });
    });
    
    request.on('error', (err) => {
      if (err.code === 'ECONNABORTED') {
        return res.status(504).json({ error: 'Request timed out after 5 seconds' });
      }
      res.status(500).json({ error: err.message });
    });
    
    request.on('timeout', () => {
      request.destroy();
      res.status(504).json({ error: 'Request timed out after 5 seconds' });
    });
    
    request.end();
    
  } catch (err) {
    if (err.message === 'Resolved to private or blocked IP address') {
      return res.status(403).json({ error: 'Access to private or blocked IPs is forbidden.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;