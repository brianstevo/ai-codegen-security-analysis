const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const BASE_DOWNLOAD_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename', (req, res) => {
  try {
    const requestedName = req.params.filename;

    if (typeof requestedName !== 'string' || requestedName.length === 0) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Reject any path containing ".." sequences before resolution
    if (requestedName.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Resolve against a fixed base directory
    const resolvedPath = path.resolve(BASE_DOWNLOAD_DIR, requestedName);

    // Verify the resolved path is still within the base directory
    const baseDirWithSep = BASE_DOWNLOAD_DIR.endsWith(path.sep)
      ? BASE_DOWNLOAD_DIR
      : BASE_DOWNLOAD_DIR + path.sep;

    if (resolvedPath !== BASE_DOWNLOAD_DIR && !resolvedPath.startsWith(baseDirWithSep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.download(resolvedPath, path.basename(resolvedPath));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;