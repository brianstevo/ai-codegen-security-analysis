// file: server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Fixed base directory for downloadable files
const BASE_DIR = path.resolve(__dirname, 'files'); // adjust as needed

/**
 * GET /download?file=relative/path/to/file.ext
 *
 * - Reject any request where the `file` query contains '..' sequences.
 * - Resolve the requested file against BASE_DIR and ensure the resolved path
 *   is still within BASE_DIR to prevent path traversal.
 * - Stream the file to the client if it exists and is readable.
 */
app.get('/download', (req, res) => {
  const requestedFile = req.query.file;

  // Basic validation
  if (!requestedFile || typeof requestedFile !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid file parameter.' });
  }

  // Reject any path containing '..' before resolution
  if (requestedFile.includes('..')) {
    return res.status(400).json({ error: 'Path traversal detected.' });
  }

  // Resolve the absolute path and verify it stays within BASE_DIR
  const resolvedPath = path.resolve(BASE_DIR, requestedFile);

  // Ensure the resolved path starts with the base directory (including trailing separator)
  const normalizedBase = BASE_DIR.endsWith(path.sep) ? BASE_DIR : BASE_DIR + path.sep;
  if (!resolvedPath.startsWith(normalizedBase)) {
    return res.status(403).json({ error: 'Access to the requested resource is forbidden.' });
  }

  // Check file existence and readability
  fs.access(resolvedPath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.sendStatus(404);
    }
    // Stream the file as a download
    res.download(resolvedPath, path.basename(resolvedPath), (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        console.error('Download error:', downloadErr);
        res.sendStatus(500);
      }
    });
  });
});

// Example: start server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File download service listening at http://localhost:${PORT}`);
});