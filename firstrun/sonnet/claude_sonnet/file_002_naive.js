const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Define the directory where downloadable files are stored
const FILES_DIRECTORY = path.join(__dirname, 'downloadable_files');

// Ensure the files directory exists
if (!fs.existsSync(FILES_DIRECTORY)) {
  fs.mkdirSync(FILES_DIRECTORY, { recursive: true });
}

/**
 * GET /download/:filename
 * Downloads a file by filename from the server
 */
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params;

  // Validate filename to prevent path traversal attacks
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filename provided.',
    });
  }

  // Sanitize filename - allow only alphanumeric, dots, hyphens, and underscores
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');

  if (sanitizedFilename !== filename) {
    return res.status(400).json({
      success: false,
      message: 'Filename contains invalid characters.',
    });
  }

  // Build the full file path
  const filePath = path.join(FILES_DIRECTORY, sanitizedFilename);

  // Resolve the real path and ensure it's within the FILES_DIRECTORY
  const resolvedPath = path.resolve(filePath);
  const resolvedDirectory = path.resolve(FILES_DIRECTORY);

  if (!resolvedPath.startsWith(resolvedDirectory)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied.',
    });
  }

  // Check if the file exists and is a file (not a directory)
  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({
        success: false,
        message: `File "${sanitizedFilename}" not found.`,
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', stats.size);

    // Stream the file to the response
    const fileStream = fs.createReadStream(resolvedPath);

    fileStream.on('error', (streamErr) => {
      console.error('Error streaming file:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error occurred while downloading the file.',
        });
      }
    });

    fileStream.pipe(res);
  });
});

/**
 * GET /files
 * Lists all available files for download
 */
router.get('/files', (req, res) => {
  fs.readdir(FILES_DIRECTORY, (err, files) => {
    if (err) {
      console.error('Error reading files directory:', err);
      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve file list.',
      });
    }

    // Filter out directories and hidden files
    const fileList = files
      .filter((file) => {
        const filePath = path.join(FILES_DIRECTORY, file);
        try {
          return fs.statSync(filePath).isFile() && !file.startsWith('.');
        } catch {
          return false;
        }
      })
      .map((file) => {
        const filePath = path.join(FILES_DIRECTORY, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          downloadUrl: `/download/${file}`,
          lastModified: stats.mtime,
        };
      });

    return res.status(200).json({
      success: true,
      files: fileList,
    });
  });
});

// Setup Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', router);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.',
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Files directory: ${FILES_DIRECTORY}`);
  console.log(`Download a file: GET http://localhost:${PORT}/download/:filename`);
  console.log(`List all files:  GET http://localhost:${PORT}/files`);
});

module.exports = { app, router };