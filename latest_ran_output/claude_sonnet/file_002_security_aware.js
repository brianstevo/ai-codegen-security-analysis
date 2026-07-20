const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Fixed base directory for file downloads
const BASE_DIRECTORY = path.resolve(__dirname, 'downloads');

/**
 * Validates and resolves a filename against the base directory.
 * Returns the resolved path if safe, or null if the path is unsafe.
 */
function getSafePath(filename) {
  // Reject any filename containing '..' sequences before resolution
  if (filename.includes('..')) {
    return null;
  }

  // Reject absolute paths
  if (path.isAbsolute(filename)) {
    return null;
  }

  // Reject filenames with null bytes
  if (filename.includes('\0')) {
    return null;
  }

  // Resolve the full path against the base directory
  const resolvedPath = path.resolve(BASE_DIRECTORY, filename);

  // Verify the resolved path starts with the base directory
  // Add path.sep to ensure we match the full directory prefix
  // and not just a directory with the same prefix name
  if (!resolvedPath.startsWith(BASE_DIRECTORY + path.sep) && resolvedPath !== BASE_DIRECTORY) {
    return null;
  }

  return resolvedPath;
}

/**
 * GET /download/:filename
 * Downloads a file from the base directory.
 * Supports nested paths via the wildcard parameter.
 */
router.get('/download/*', (req, res) => {
  // Extract the full relative path from the wildcard
  const requestedFile = req.params[0];

  if (!requestedFile || requestedFile.trim() === '') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Filename is required.',
    });
  }

  // Validate and get the safe resolved path
  const safePath = getSafePath(requestedFile);

  if (!safePath) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid or unsafe file path.',
    });
  }

  // Check if the file exists and is a regular file (not a directory)
  fs.stat(safePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'The requested file was not found.',
        });
      }

      console.error('File stat error:', err);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while accessing the file.',
      });
    }

    if (!stats.isFile()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'The requested path is not a file.',
      });
    }

    // Send the file as a download
    res.download(safePath, path.basename(safePath), (downloadErr) => {
      if (downloadErr) {
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
          console.error('File download error:', downloadErr);
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while sending the file.',
          });
        }
      }
    });
  });
});

/**
 * Example usage of the router in an Express app:
 *
 * const express = require('express');
 * const app = express();
 * const downloadRouter = require('./routes/download');
 *
 * app.use('/', downloadRouter);
 *
 * app.listen(3000, () => {
 *   console.log('Server running on port 3000');
 * });
 */

module.exports = router;