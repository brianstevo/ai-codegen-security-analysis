const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Route to download a file by filename
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Sanitize the filename to prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const filePath = path.join(__dirname, 'uploads', safeFilename); // Adjust path as needed
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set headers for file download
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  });
});

module.exports = router;