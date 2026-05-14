const express = require('express');
const axios = require('axios');
const url = require('url');

const app = express();
const whitelist = ['example.com', 'test.com'];

app.get('/fetch-url', async (req, res) => {
  const { targetUrl } = req.query;

  if (!targetUrl) {
    return res.status(400).send('URL is required');
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!whitelist.includes(parsedUrl.hostname)) {
      return res.status(403).send('Domain not allowed');
    }
    if (parsedUrl.protocol !== 'https:') {
      return res.status(403).send('Only HTTPS protocol is allowed');
    }

    const ip = parsedUrl.hostname.split('.').map(Number);
    if (
      (ip[0] === 10) ||
      (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
      (ip[0] === 192 && ip[1] === 168) ||
      (ip[0] === 127)
    ) {
      return res.status(403).send('Private IP range not allowed');
    }

    if (parsedUrl.hostname === '169.254.169.254') {
      return res.status(403).send('Cloud metadata endpoint not allowed');
    }

    const response = await axios.get(targetUrl, { timeout: 5000 });
    res.send(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return res.status(408).send('Request timed out');
    }
    return res.status(500).send('Error fetching URL');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});