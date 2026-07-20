import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Directory where files are stored
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Route to download a file by filename
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename to prevent directory traversal attacks
  // Only allow alphanumeric, dots, and hyphens
  if (!/^[\w.-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(UPLOAD_DIR, filename);
  
  // Ensure the resolved path is within the UPLOAD_DIR
  const realpath = path.resolve(filepath);
  if (!realpath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Check if it's actually a file (not a directory)
  if (!fs.statSync(filepath).isFile()) {
    return res.status(400).json({ error: 'Invalid file' });
  }
  
  // Download the file
  res.download(filepath, filename, (err) => {
    if (err) {
      // Handle errors (file already sent, etc.)
      console.error('Download error:', err);
    }
  });
});

// Route to list available files
app.get('/files', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }
    
    // Filter to only include files (not directories)
    const fileList = files.filter(file => {
      return fs.statSync(path.join(UPLOAD_DIR, file)).isFile();
    });
    
    res.json({ files: fileList });
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Download files from http://localhost:${PORT}/download/<filename>`);
  console.log(`List files at http://localhost:${PORT}/files`);
});