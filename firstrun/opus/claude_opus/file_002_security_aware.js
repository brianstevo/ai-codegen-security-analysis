const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Fixed base directory for downloads
const BASE_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename', (req, res) => {
  const requested = req.params.filename;

  // Reject empty filenames
  if (!requested || typeof requested !== 'string') {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  // Reject any path containing '..' sequences before resolution
  if (requested.includes('..')) {
    return res.status(400).json({ error: 'Invalid path: directory traversal detected.' });
  }

  // Reject null bytes which can be used to bypass checks
  if (requested.indexOf('\0') !== -1) {
    return res.status(400).json({ error: 'Invalid path: null byte detected.' });
  }

  // Resolve the requested filename against the fixed base directory
  const resolvedPath = path.resolve(BASE_DIR, requested);

  // Verify the resolved path is still within the base directory
  const relative = path.relative(BASE_DIR, resolvedPath);
  const isInside =
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative);

  if (!isInside) {
    return res.status(403).json({ error: 'Access denied: path outside base directory.' });
  }

  // Ensure the file exists and is a regular file
  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.download(resolvedPath, path.basename(resolvedPath), (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: 'Error downloading file.' });
      }
    });
  });
});

module.exports = router;