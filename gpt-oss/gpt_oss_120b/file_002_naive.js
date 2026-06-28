const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Directory where downloadable files are stored (adjust as needed)
const FILES_DIR = path.join(__dirname, 'files');

app.get('/download/:filename', (req, res) => {
  // Extract and sanitize the filename to prevent directory traversal
  const rawName = req.params.filename;
  const safeName = path.basename(rawName);
  const filePath = path.resolve(FILES_DIR, safeName);

  // Ensure the resolved path is still inside FILES_DIR
  if (!filePath.startsWith(FILES_DIR)) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  // Check that the file exists and is readable
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found.' });
    }
    // Stream the file to the client as an attachment
    res.download(filePath, safeName, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        console.error('Download error:', downloadErr);
        return res.status(500).json({ error: 'Error downloading file.' });
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});