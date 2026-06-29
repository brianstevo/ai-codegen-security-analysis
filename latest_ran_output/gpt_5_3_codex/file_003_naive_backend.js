const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory where logs are stored
const LOG_DIR = path.join(__dirname, 'logs');

// Whitelist allowed log files
const ALLOWED_LOGS = new Set(['app.log', 'error.log', 'access.log']);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/logs/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    if (!ALLOWED_LOGS.has(filename)) {
      return res.status(400).json({ error: 'Invalid log file selection' });
    }

    const filePath = path.join(LOG_DIR, filename);

    // Ensure resolved path stays inside LOG_DIR
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(path.normalize(LOG_DIR + path.sep))) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const content = await fs.readFile(normalized, 'utf8');
    return res.json({ filename, content });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Log file not found' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error reading log file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});