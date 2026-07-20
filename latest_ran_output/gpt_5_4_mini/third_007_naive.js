const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }

  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return true;
}

async function validateUrlSafety(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname;
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length) {
    throw new Error('Unable to resolve hostname');
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new Error('Blocked host');
    }
  }

  return parsed;
}

function fetchWithLimit(parsedUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) {
      return reject(new Error('Too many redirects'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.request(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'ExpressFetcher/1.0',
          'Accept': '*/*',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;

        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          try {
            const nextUrl = new URL(location, parsedUrl);
            return resolve(fetchWithLimit(nextUrl, redirectCount + 1));
          } catch (e) {
            return reject(new Error('Invalid redirect URL'));
          }
        }

        const chunks = [];
        let total = 0;
        const MAX_BYTES = 1024 * 1024; // 1 MB

        res.on('data', (chunk) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            req.destroy();
            res.destroy();
            reject(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: status,
            headers: res.headers,
            body,
          });
        });

        res.on('error', reject);
      }
    );

    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.on('error', reject);
    req.end();
  });
}

router.get('/fetch', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    const parsedUrl = await validateUrlSafety(rawUrl);
    const result = await fetchWithLimit(parsedUrl);

    res.status(result.statusCode || 200);
    res.set('Content-Type', result.headers['content-type'] || 'application/octet-stream');

    const textTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-www-form-urlencoded',
    ];
    const contentType = String(result.headers['content-type'] || '').toLowerCase();

    if (textTypes.some((t) => contentType.startsWith(t))) {
      return res.send(result.body.toString('utf8'));
    }

    return res.send(result.body);
  } catch (err) {
    return res.status(400).json({
      error: err.message || 'Failed to fetch URL',
    });
  }
});

module.exports = router;