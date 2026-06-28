const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Fixed base directory for files
const BASE_DIR = path.resolve(__dirname, 'uploads');

router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;

  // Reject any path containing '..' sequences before resolution
  if (filename.includes('..')) {
    return res.status(403).send('Forbidden: Path traversal detected.');
  }

  // Resolve the requested filename against the fixed base directory
  const filePath = path.join(BASE_DIR, filename);

  // Verify the resolved path is still within the base directory to prevent path traversal attacks
  if (!filePath.startsWith(BASE_DIR)) {
    return res.status(403).send('Forbidden: Access denied.');
  }

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found.');
    }

    // Send the file as a download
    res.download(filePath, filename);
  });
});

module.exports = router;