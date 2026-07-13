import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Served files should be in a specific directory for security
const FILES_DIR = path.join(__dirname, 'files');

// Ensure the files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Route to download a file
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;

  // Validate filename to prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filepath = path.join(FILES_DIR, filename);

  // Verify the file is within the allowed directory
  if (!filepath.startsWith(FILES_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if file exists
  fs.access(filepath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(filepath);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    });

    fileStream.pipe(res);
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File download server running on http://localhost:${PORT}`);
  console.log(`Files directory: ${FILES_DIR}`);
  console.log(`Download endpoint: http://localhost:${PORT}/download/:filename`);
});