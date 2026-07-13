const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DOWNLOAD_DIR = path.join(__dirname, 'uploads');

// GET /download/:filename
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal by resolving the final path and ensuring it stays inside DOWNLOAD_DIR
  const safeFilename = path.basename(filename);
  const filePath = path.resolve(DOWNLOAD_DIR, safeFilename);

  if (!filePath.startsWith(path.resolve(DOWNLOAD_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.download(filePath, safeFilename, (downloadErr) => {
      if (downloadErr) {
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Could not download file' });
        }
      }
    });
  });
});

module.exports = router;