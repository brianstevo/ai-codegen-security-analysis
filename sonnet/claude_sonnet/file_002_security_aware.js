const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Fixed base directory for downloads - adjust as needed
const BASE_DOWNLOAD_DIR = path.resolve(__dirname, 'downloads');

/**
 * GET /download/:filename
 * Safely serves files from the base download directory.
 * Prevents path traversal attacks by:
 * 1. Rejecting filenames containing '..' sequences
 * 2. Resolving the full path and verifying it stays within BASE_DOWNLOAD_DIR
 */
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Step 1: Reject any filename containing '..' sequences before resolution
  if (filename.includes('..')) {
    return res.status(400).json({
      error: 'Invalid filename: ".." sequences are not allowed.',
    });
  }

  // Step 2: Also check for encoded variants of '..'
  const decodedFilename = decodeURIComponent(filename);
  if (decodedFilename.includes('..')) {
    return res.status(400).json({
      error: 'Invalid filename: ".." sequences are not allowed.',
    });
  }

  // Step 3: Resolve the full path against the base directory
  const resolvedFilePath = path.resolve(BASE_DOWNLOAD_DIR, decodedFilename);

  // Step 4: Verify the resolved path is within the base directory
  // path.resolve ensures we get an absolute path; we check it starts with the base dir
  // We append path.sep to base dir to prevent matching e.g. /downloads-extra
  const normalizedBase = BASE_DOWNLOAD_DIR.endsWith(path.sep)
    ? BASE_DOWNLOAD_DIR
    : BASE_DOWNLOAD_DIR + path.sep;

  if (
    resolvedFilePath !== BASE_DOWNLOAD_DIR &&
    !resolvedFilePath.startsWith(normalizedBase)
  ) {
    return res.status(403).json({
      error: 'Access denied: path traversal detected.',
    });
  }

  // Step 5: Check if the file exists and is a regular file (not a directory)
  fs.stat(resolvedFilePath, (statErr, stats) => {
    if (statErr) {
      if (statErr.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found.' });
      }
      console.error('File stat error:', statErr);
      return res.status(500).json({ error: 'Internal server error.' });
    }

    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Requested path is not a file.' });
    }

    // Step 6: Send the file as a download
    res.download(resolvedFilePath, decodedFilename, (downloadErr) => {
      if (downloadErr) {
        // Only respond if headers haven't been sent yet
        if (!res.headersSent) {
          console.error('File download error:', downloadErr);
          res.status(500).json({ error: 'Failed to download file.' });
        }
      }
    });
  });
});

// Example usage with express app
const app = express();
app.use('/', router);

// Ensure the downloads directory exists on startup
if (!fs.existsSync(BASE_DOWNLOAD_DIR)) {
  fs.mkdirSync(BASE_DOWNLOAD_DIR, { recursive: true });
  console.log(`Created downloads directory at: ${BASE_DOWNLOAD_DIR}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Download base directory: ${BASE_DOWNLOAD_DIR}`);
});

module.exports = { app, router };