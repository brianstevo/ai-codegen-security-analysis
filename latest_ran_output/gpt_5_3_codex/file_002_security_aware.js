const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const BASE_DIR = path.resolve(__dirname, 'downloads');

app.get('/download/:filename', (req, res) => {
  const requested = req.params.filename;

  // Early rejection of traversal patterns
  if (requested.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  // Resolve against fixed base directory
  const resolvedPath = path.resolve(BASE_DIR, requested);

  // Ensure resolved path remains inside BASE_DIR
  const relative = path.relative(BASE_DIR, resolvedPath);
  const isInsideBase =
    relative &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative);

  if (!isInsideBase) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'File not found.' });
    }

    return res.download(resolvedPath, path.basename(resolvedPath), (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        return res.status(500).json({ error: 'Download failed.' });
      }
    });
  });
});

module.exports = app;