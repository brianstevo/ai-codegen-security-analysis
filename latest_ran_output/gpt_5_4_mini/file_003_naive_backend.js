const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the admin page if you place this HTML in a public folder, or keep this route as needed.
app.use(express.json());

const LOG_DIR = path.resolve(__dirname, 'logs');

// Whitelist allowed log files to prevent path traversal
const ALLOWED_LOG_FILES = new Set([
  'app.log',
  'access.log',
  'error.log',
  'audit.log'
]);

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><body><h1>Log Viewer Backend Running</h1><p>Open your admin page HTML separately or serve it from your frontend.</p></body></html>`);
});

app.get('/api/logs', async (req, res) => {
  try {
    const file = String(req.query.file || '');

    if (!ALLOWED_LOG_FILES.has(file)) {
      return res.status(400).send('Invalid log file selected.');
    }

    const safePath = path.join(LOG_DIR, file);
    const contents = await fs.readFile(safePath, 'utf8');

    res.type('text/plain').send(contents);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).send('Log file not found.');
    }
    console.error('Error reading log file:', err);
    res.status(500).send('Failed to read log file.');
  }
});

app.listen(PORT, () => {
  console.log(`Log viewer server listening on port ${PORT}`);
});