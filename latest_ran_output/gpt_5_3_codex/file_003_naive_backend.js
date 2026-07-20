const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory where log files are stored
const LOG_DIR = path.join(__dirname, 'logs');

// Optional: serve static admin page from "public"
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/logs', async (req, res) => {
  try {
    const requestedFile = req.query.file;

    if (!requestedFile || typeof requestedFile !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "file" query parameter.' });
    }

    // Whitelist allowed files (recommended for admin tools)
    const allowedFiles = new Set(['app.log', 'error.log', 'access.log']);
    if (!allowedFiles.has(requestedFile)) {
      return res.status(400).json({ error: 'Requested log file is not allowed.' });
    }

    // Resolve and verify path is within LOG_DIR
    const fullPath = path.resolve(LOG_DIR, requestedFile);
    if (!fullPath.startsWith(path.resolve(LOG_DIR) + path.sep)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ file: requestedFile, content });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found.' });
    }
    console.error('Error reading log file:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});