const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Directory where downloadable files are stored
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;

  // Prevent path traversal and invalid file names
  if (!filename || filename.includes('..') || path.isAbsolute(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(DOWNLOAD_DIR, filename);

  // Ensure resolved path stays within DOWNLOAD_DIR
  if (!filePath.startsWith(DOWNLOAD_DIR)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  });
});

module.exports = app;