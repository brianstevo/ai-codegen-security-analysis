const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Base directory for file downloads (configure as needed)
const BASE_DIR = path.resolve(__dirname, 'uploads');

router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Reject any path containing '..' sequences to prevent path traversal
  if (filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename: path traversal detected' });
  }
  
  // Resolve the full path
  const fullPath = path.resolve(BASE_DIR, filename);
  
  // Verify the resolved path is within BASE_DIR
  if (!fullPath.startsWith(path.resolve(BASE_DIR) + path.sep) && fullPath !== path.resolve(BASE_DIR)) {
    return res.status(403).json({ error: 'Access denied: file outside allowed directory' });
  }
  
  // Check if file exists
  fs.access(fullPath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found or cannot be read' });
    }
    
    // Send the file for download
    res.download(fullPath, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  });
});

module.exports = router;