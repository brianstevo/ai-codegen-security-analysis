const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Base directory where downloadable files are stored.
// Files outside this directory can never be accessed.
const DOWNLOAD_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Reject anything that isn't a plain filename (no slashes, no null bytes).
  // This blocks path traversal attempts like "../../etc/passwd".
  if (
    typeof filename !== 'string' ||
    filename.length === 0 ||
    filename.includes('\0') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename !== path.basename(filename)
  ) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  // Resolve the absolute path and ensure it stays inside DOWNLOAD_DIR.
  const requestedPath = path.resolve(DOWNLOAD_DIR, filename);
  const relative = path.relative(DOWNLOAD_DIR, requestedPath);

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    path.dirname(requestedPath) !== DOWNLOAD_DIR
  ) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  // Ensure the file exists and is a regular file (not a directory/symlink target).
  fs.stat(requestedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(requestedPath, filename, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  });
});

module.exports = router;