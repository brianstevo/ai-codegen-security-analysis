const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Base directory for file downloads (configure as needed)
const BASE_DIR = path.resolve(__dirname, 'uploads');

router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Reject paths containing '..' sequences to prevent path traversal
  if (filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename: path traversal detected' });
  }
  
  // Resolve the full path
  const resolvedPath = path.resolve(BASE_DIR, filename);
  
  // Verify the resolved path is within BASE_DIR
  if (!resolvedPath.startsWith(BASE_DIR + path.sep) && resolvedPath !== BASE_DIR) {
    return res.status(403).json({ error: 'Access denied: file outside allowed directory' });
  }
  
  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Send the file for download
  res.download(resolvedPath, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
});

module.exports = router;