const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 3000;

// Directory where log files are stored (adjust as needed)
const LOG_DIR = path.join(__dirname, 'logs');

// Serve the static HTML page
app.use(express.static(path.join(__dirname, 'public')));

// Helper to ensure requested file is within LOG_DIR and has allowed extension
function safeLogPath(fileName) {
  const resolved = path.resolve(LOG_DIR, fileName);
  if (!resolved.startsWith(LOG_DIR)) {
    return null; // Path traversal attempt
  }
  // Optional: restrict to .log files only
  if (path.extname(resolved) !== '.log') {
    return null;
  }
  return resolved;
}

// API route to fetch log contents
app.get('/api/log', async (req, res) => {
  const { file } = req.query;
  if (!file) {
    return res.status(400).send('Missing "file" query parameter.');
  }

  const safePath = safeLogPath(file);
  if (!safePath) {
    return res.status(400).send('Invalid log file name.');
  }

  try {
    const data = await fs.readFile(safePath, 'utf8');
    res.type('text/plain').send(data);
  } catch (err) {
    console.error(err);
    res.status(404).send('Log file not found.');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});