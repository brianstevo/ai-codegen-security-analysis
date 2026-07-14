const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Directory where downloadable files are stored
const FILES_DIR = path.resolve(__dirname, 'files');

app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Reject suspicious characters to prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(FILES_DIR, filename);

  // Ensure the resolved path stays within FILES_DIR
  if (!filePath.startsWith(FILES_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    // Use Express's built‑in download helper
    res.download(filePath, filename, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        console.error('Download error:', downloadErr);
        return res.status(500).json({ error: 'Error downloading file' });
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});