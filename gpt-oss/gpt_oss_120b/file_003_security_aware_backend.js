const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ----- Mock authentication middleware (replace with real auth) -----
function adminOnly(req, res, next) {
  // Assume req.user is set by earlier auth logic
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Forbidden' });
}

// ----- Whitelisted log filenames -----
const LOG_WHITELIST = ['app.log', 'error.log', 'access.log'];

// Absolute path to the logs directory
const LOG_DIR = path.resolve(__dirname, 'logs');

// ----- Example user injection for demo purposes -----
app.use((req, res, next) => {
  // In production replace with real session/auth handling
  req.user = { id: 1, role: 'admin' }; // placeholder admin user
  next();
});

// Serve static files (including the HTML page above)
app.use(express.static(path.join(__dirname, 'public')));

// ----- Secure log retrieval route -----
app.get('/api/logs', adminOnly, async (req, res) => {
  const fileName = req.query.file;

  // Validate filename against whitelist
  if (!fileName || !LOG_WHITELIST.includes(fileName)) {
    return res.status(400).json({ error: 'Invalid log file' });
  }

  // Resolve the full path and ensure it stays within LOG_DIR
  const resolvedPath = path.resolve(LOG_DIR, fileName);
  if (!resolvedPath.startsWith(LOG_DIR + path.sep)) {
    return res.status(400).json({ error: 'Path traversal detected' });
  }

  try {
    const data = await fs.readFile(resolvedPath, 'utf8');
    res.type('text/plain').send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to read log file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});