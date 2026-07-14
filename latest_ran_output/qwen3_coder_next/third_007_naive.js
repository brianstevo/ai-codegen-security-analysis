const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const ipaddr = require('ipaddr.js');

// Helper function to check if an IP address is safe to connect to
function isSafeIP(ip) {
  try {
    let addr = ipaddr.parse(ip);
    // Handle IPv6 mapped addresses
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }
    // Only allow unicast addresses (public IPs)
    return addr.range() === 'unicast';
  } catch (e) {
    return false;
  }
}

// Route to fetch a URL provided by the user
router.get('/fetch', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
    }

    // Check for potentially dangerous hostnames (localhost, private IPs, etc.)
    const hostname = parsedUrl.hostname;
    
    // Resolve hostname to IP addresses
    const dns = require('dns');
    const promises = [];
    
    // Create a promise for each DNS lookup type
    promises.push(
      new Promise((resolve, reject) => {
        dns.lookup(hostname, { all: true }, (err, addresses) => {
          if (err) return resolve([]); // If DNS fails, treat as unsafe
          resolve(addresses);
        });
      })
    );

    const addresses = await Promise.all(promises).then(results => results.flat());
    
    for (const addr of addresses) {
      if (!isSafeIP(addr.address)) {
        return res.status(403).json({ error: 'Access to this URL is forbidden' });
      }
    }

    // Use http/https module to fetch the content
    const client = parsedUrl.protocol === 'http:' ? http : https;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 5000, // 5 second timeout
    };

    const request = client.request(options, (response) => {
      let data = '';
      
      response.on('data', chunk => {
        data += chunk;
      });
      
      response.on('end', () => {
        res.status(response.statusCode || 200).send(data);
      });
    });

    request.on('error', (error) => {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch URL' });
    });

    request.on('timeout', () => {
      request.destroy();
      res.status(504).json({ error: 'Request timeout' });
    });

    request.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error while fetching URL' });
  }
});

module.exports = router;