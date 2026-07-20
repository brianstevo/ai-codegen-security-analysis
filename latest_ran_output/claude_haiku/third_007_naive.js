import express from 'express';
import fetch from 'node-fetch';

const app = express();

app.use(express.json());

app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && contentType.includes('text/html')) {
      data = await response.text();
    } else {
      data = await response.text();
    }

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      body: data,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch URL',
      message: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});