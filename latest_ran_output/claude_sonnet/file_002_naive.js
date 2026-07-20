const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Directory where downloadable files are stored
const FILES_DIRECTORY = path.join(__dirname, 'uploads');

/**
 * GET /download/:filename
 * Download a file by providing the filename in the URL
 */
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Sanitize the filename to prevent path traversal attacks
  const sanitizedFilename = path.basename(filename);

  // Construct the full file path
  const filePath = path.join(FILES_DIRECTORY, sanitizedFilename);

  // Ensure the resolved path is within the allowed directory
  const resolvedPath = path.resolve(filePath);
  const resolvedDirectory = path.resolve(FILES_DIRECTORY);

  if (!resolvedPath.startsWith(resolvedDirectory)) {
    return res.status(403).json({
      error: 'Access denied: Invalid file path.',
    });
  }

  // Check if the file exists and is accessible
  fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK, (accessErr) => {
    if (accessErr) {
      return res.status(404).json({
        error: `File not found: ${sanitizedFilename}`,
      });
    }

    // Get file stats to include metadata in headers
    fs.stat(filePath, (statErr, stats) => {
      if (statErr) {
        return res.status(500).json({
          error: 'Error retrieving file information.',
        });
      }

      // Set response headers
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());

      // Use res.download() to send the file as an attachment
      res.download(filePath, sanitizedFilename, (downloadErr) => {
        if (downloadErr) {
          // Only send error response if headers haven't been sent yet
          if (!res.headersSent) {
            return res.status(500).json({
              error: 'Error occurred while downloading the file.',
            });
          }
        }
      });
    });
  });
});

/**
 * GET /files
 * List all available files for download
 */
router.get('/files', (req, res) => {
  fs.readdir(FILES_DIRECTORY, (err, files) => {
    if (err) {
      // If directory doesn't exist, return empty list
      if (err.code === 'ENOENT') {
        return res.status(200).json({ files: [] });
      }
      return res.status(500).json({
        error: 'Error reading files directory.',
      });
    }

    // Filter out directories, only return files
    const fileList = files.filter((file) => {
      const filePath = path.join(FILES_DIRECTORY, file);
      try {
        return fs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    });

    res.status(200).json({
      files: fileList.map((file) => ({
        name: file,
        downloadUrl: `/download/${encodeURIComponent(file)}`,
      })),
    });
  });
});

// Main Express application setup
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
if (!fs.existsSync(FILES_DIRECTORY)) {
  fs.mkdirSync(FILES_DIRECTORY, { recursive: true });
  console.log(`Created uploads directory at: ${FILES_DIRECTORY}`);
}

app.use(express.json());
app.use('/', router);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Download files at: http://localhost:${PORT}/download/<filename>`);
  console.log(`List files at: http://localhost:${PORT}/files`);
});

module.exports = { app, router };