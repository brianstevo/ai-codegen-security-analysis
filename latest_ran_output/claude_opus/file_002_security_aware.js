const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Fixed base directory for downloads
const BASE_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename(*)', (req, res) => {
  const requestedName = req.params.filename;

  // Basic presence check
  if (!requestedName || typeof requestedName !== 'string') {
    return res.status(400).json({ error: 'Filename is required.' });
  }

  // Reject any path containing '..' sequences before resolution
  // Decode first to catch encoded traversal attempts, then inspect.
  let decodedName;
  try {
    decodedName = decodeURIComponent(requestedName);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid filename encoding.' });
  }

  if (decodedName.includes('..')) {
    return res.status(400).json({ error: 'Invalid path: parent directory references are not allowed.' });
  }

  // Reject null bytes which can be used to bypass checks
  if (decodedName.includes('\0')) {
    return res.status(400).json({ error: 'Invalid path.' });
  }

  // Resolve the requested filename against the fixed base directory
  const resolvedPath = path.resolve(BASE_DIR, decodedName);

  // Verify the resolved path is still within the base directory.
  // Append path separator to prevent sibling-directory prefix matches
  // (e.g., /base-evil vs /base).
  const baseWithSep = BASE_DIR.endsWith(path.sep) ? BASE_DIR : BASE_DIR + path.sep;

  if (resolvedPath !== BASE_DIR && !resolvedPath.startsWith(baseWithSep)) {
    return res.status(403).json({ error: 'Access denied: path outside allowed directory.' });
  }

  // Ensure the file exists and is a regular file
  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Trigger a download with the safe base name
    res.download(resolvedPath, path.basename(resolvedPath), (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: 'Error downloading file.' });
      }
    });
  });
});

module.exports = router;