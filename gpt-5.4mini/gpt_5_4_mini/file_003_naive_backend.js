const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_DIR = path.join(__dirname, 'logs');
const ALLOWED_LOG_FILES = new Set(['app.log', 'error.log', 'access.log']);

app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/logs', async (req, res) => {
  try {
    const file = String(req.query.file || '');

    if (!ALLOWED_LOG_FILES.has(file)) {
      return res.status(400).send('Invalid log file selected.');
    }

    const filePath = path.join(LOG_DIR, file);

    // Prevent path traversal by ensuring the resolved path stays inside LOG_DIR
    const resolvedLogDir = path.resolve(LOG_DIR) + path.sep;
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedLogDir)) {
      return res.status(400).send('Invalid file path.');
    }

    const contents = await fs.readFile(resolvedFilePath, 'utf8');
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
  console.log(`Log viewer server running on http://localhost:${PORT}`);
});