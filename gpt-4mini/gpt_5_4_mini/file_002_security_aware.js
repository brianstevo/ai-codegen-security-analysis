const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const BASE_DIR = path.resolve(__dirname, 'downloads');

router.get('/download/:filename', (req, res) => {
  try {
    const requestedFilename = req.params.filename;

    if (requestedFilename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const resolvedPath = path.resolve(BASE_DIR, requestedFilename);

    const relative = path.relative(BASE_DIR, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.download(resolvedPath);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;