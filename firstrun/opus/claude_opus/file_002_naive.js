const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Base directory where downloadable files are stored
const DOWNLOAD_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Reject any filename that contains path separators or traversal sequences
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    path.basename(filename) !== filename
  ) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  // Resolve the requested path and ensure it stays inside DOWNLOAD_DIR
  const requestedPath = path.resolve(DOWNLOAD_DIR, filename);
  const relative = path.relative(DOWNLOAD_DIR, requestedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Verify the file exists and is a regular file
  fs.stat(requestedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.download(requestedPath, filename, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: 'Error downloading file.' });
      }
    });
  });
});

module.exports = router;