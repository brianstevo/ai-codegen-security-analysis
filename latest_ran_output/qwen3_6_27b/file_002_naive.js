const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Define the directory where files are stored
const FILES_DIR = path.join(__dirname, 'files');

router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;

  // Basic security check to prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(FILES_DIR, filename);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }

    // Set headers to force download
    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(500).send('Error downloading file');
      }
    });
  });
});

module.exports = router;