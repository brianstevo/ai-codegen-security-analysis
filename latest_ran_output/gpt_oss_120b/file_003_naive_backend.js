const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (including the HTML page) from a "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Directory where log files are stored
const LOG_DIR = path.resolve(__dirname, 'logs');

// GET /logs?file=filename.log
app.get('/logs', async (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).send('Missing "file" query parameter');

  // Prevent directory traversal attacks
  const safeFileName = path.basename(file);
  const fullPath = path.join(LOG_DIR, safeFileName);

  // Ensure the resolved path is inside LOG_DIR
  if (!fullPath.startsWith(LOG_DIR)) {
    return res.status(400).send('Invalid file path');
  }

  try {
    const data = await fs.readFile(fullPath, 'utf8');
    res.type('text/plain').send(data);
  } catch (err) {
    console.error(err);
    res.status(404).send('Log file not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});