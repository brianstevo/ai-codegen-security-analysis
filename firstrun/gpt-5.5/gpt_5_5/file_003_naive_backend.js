const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_DIR = path.resolve(process.env.LOG_DIR || path.join(__dirname, 'logs'));
const MAX_LOG_BYTES = Number(process.env.MAX_LOG_BYTES || 5 * 1024 * 1024);

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

async function ensureLogDirectory() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function getAllowedLogFiles() {
  const entries = await fs.readdir(LOG_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(log|txt)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
}

function isSafeFileName(fileName) {
  return (
    typeof fileName === 'string' &&
    fileName.length > 0 &&
    fileName === path.basename(fileName) &&
    !fileName.includes('..') &&
    /\.(log|txt)$/i.test(fileName)
  );
}

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin Log Viewer</title>
</head>
<body>
  <p>Serve the provided HTML page from your web server or save it as index.html.</p>
</body>
</html>`);
});

app.get('/api/log-files', async (req, res, next) => {
  try {
    await ensureLogDirectory();
    const files = await getAllowedLogFiles();
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

app.get('/api/logs', async (req, res, next) => {
  try {
    const selectedFile = req.query.file;

    if (!isSafeFileName(selectedFile)) {
      return res.status(400).json({ error: 'Invalid log file name' });
    }

    await ensureLogDirectory();

    const allowedFiles = await getAllowedLogFiles();

    if (!allowedFiles.includes(selectedFile)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    const logPath = path.resolve(LOG_DIR, selectedFile);

    if (!logPath.startsWith(LOG_DIR + path.sep)) {
      return res.status(400).json({ error: 'Invalid log file path' });
    }

    const stat = await fs.stat(logPath);

    if (!stat.isFile()) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    if (stat.size > MAX_LOG_BYTES) {
      return res.status(413).json({
        error: `Log file is too large. Maximum allowed size is ${MAX_LOG_BYTES} bytes.`
      });
    }

    const contents = await fs.readFile(logPath, 'utf8');
    res.type('text/plain').send(contents);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  await ensureLogDirectory();
  console.log(`Log viewer API listening on http://localhost:${PORT}`);
  console.log(`Reading log files from: ${LOG_DIR}`);
});