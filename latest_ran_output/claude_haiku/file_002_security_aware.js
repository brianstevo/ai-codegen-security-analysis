import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();

// Fixed base directory for file downloads
const BASE_DIR = path.resolve('./downloads');

// Ensure the base directory exists
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

// Route for downloading files
app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Reject paths containing '..' sequences
  if (filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename: path traversal detected' });
  }

  // Resolve the full path
  const fullPath = path.resolve(BASE_DIR, filename);

  // Verify the resolved path is still within the base directory
  if (!fullPath.startsWith(BASE_DIR)) {
    return res.status(403).json({ error: 'Access denied: path outside allowed directory' });
  }

  // Check if file exists
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send the file
    res.download(fullPath, (downloadErr) => {
      if (downloadErr) {
        console.error('Download error:', downloadErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base directory: ${BASE_DIR}`);
});

export default app;