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
const METADATA_ENDPOINTS = ['169.254.169.254'];

// Allowed protocols (only https)
const ALLOWED_PROTOCOLS = ['https:'];

// Helper function to check if IP is private or metadata endpoint
function isPrivateIP(ip) {
  try {
    let addr = ipaddr.parse(ip);
    
    // Handle IPv6-mapped IPv4 addresses
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }
    
    // Check against private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (addr.range(range) !== null) {
        return true;
      }
    }
    
    // Check metadata endpoints
    if (METADATA_ENDPOINTS.includes(ip)) {
      return true;
    }
    
    return false;
  } catch (e) {
    // Invalid IP address format
    return true;
  }
}

// Helper function to resolve hostname and check IPs
function checkResolvedIPs(hostname, callback) {
  const dns = require('dns');
  
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) {
      return callback(err);
    }
    
    for (const addr of addresses) {
      const ip = addr.address;
      if (isPrivateIP(ip)) {
        return callback(new Error('Access to private IP addresses is forbidden'));
      }
    }
    
    callback(null);
  });
}

// Route handler
router.get('/fetch', (req, res) => {
  const url = req.query.url;
  
  // Validate URL parameter exists
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Check protocol (only https allowed)
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
    }
    
    // Optional: Add domain whitelist check
    const allowedDomains = ['example.com', 'trusted-site.org']; // Replace with your actual whitelist
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return res.status(403).json({ error: 'Domain not in whitelist' });
    }
    
    // Check resolved IPs for private addresses
    checkResolvedIPs(parsedUrl.hostname, (err) => {
      if (err) {
        return res.status(403).json({ error: err.message });
      }
      
      // Make the request with timeout
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const request = client.request(url, { 
        timeout: 5000,
        agent: new client.Agent({
          // Disable DNS re-resolution to prevent timing attacks
          lookup: (hostname, options, callback) => {
            dns.lookup(hostname, options, (err, address, family) => {
              if (err) return callback(err);
              
              // Check the resolved IP again
              if (isPrivateIP(address)) {
                return callback(new Error('Access to private IP addresses is forbidden'));
              }
              
              callback(null, address, family);
            });
          }
        })
      }, (response) => {
        let data = '';
        
        response.on('data', chunk => {
          data += chunk;
        });
        
        response.on('end', () => {
          res.json({
            statusCode: response.statusCode,
            headers: response.headers,
            body: data
          });
        });
      });
      
      request.on('error', (err) => {
        if (err.code === 'ECONNABORTED') {
          return res.status(504).json({ error: 'Request timed out' });
        }
        res.status(500).json({ error: err.message });
      });
      
      request.on('timeout', () => {
        request.destroy();
        res.status(504).json({ error: 'Request timed out' });
      });
      
      request.end();
    });
    
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;