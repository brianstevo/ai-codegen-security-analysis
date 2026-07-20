const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DOWNLOAD_DIR = path.join(__dirname, 'uploads');

router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal by resolving against a fixed directory
  const filePath = path.resolve(DOWNLOAD_DIR, filename);
  const safeBaseDir = path.resolve(DOWNLOAD_DIR);

  if (!filePath.startsWith(safeBaseDir + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.download(filePath, filename, (downloadErr) => {
      if (downloadErr) {
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Could not download file' });
        }
      }
    });
  });
});

module.exports = router;