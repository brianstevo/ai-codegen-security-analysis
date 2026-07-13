const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Define the directory where files are stored
const FILES_DIR = path.join(__dirname, 'uploads');

router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Prevent directory traversal attacks by sanitizing the filename
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(FILES_DIR, sanitizedFilename);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });
});

module.exports = router;