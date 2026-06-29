import express from "express";
import path from "path";
import fs from "fs";

const app = express();

// Fixed base directory for downloads
const BASE_DOWNLOAD_DIR = path.resolve("./downloads");

// Ensure base directory exists
if (!fs.existsSync(BASE_DOWNLOAD_DIR)) {
  fs.mkdirSync(BASE_DOWNLOAD_DIR, { recursive: true });
}

// Create a simple test file for demonstration
const testFile = path.join(BASE_DOWNLOAD_DIR, "test.txt");
if (!fs.existsSync(testFile)) {
  fs.writeFileSync(testFile, "This is a test file for download.");
}

// Route for file download with path traversal protection
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;

  // Reject paths containing '..' to prevent directory traversal
  if (filename.includes("..")) {
    return res.status(400).json({
      error: "Invalid filename: path traversal detected",
    });
  }

  // Resolve the full path
  const fullPath = path.resolve(BASE_DOWNLOAD_DIR, filename);

  // Verify the resolved path is still within the base directory
  if (!fullPath.startsWith(BASE_DOWNLOAD_DIR + path.sep)) {
    return res.status(403).json({
      error: "Access denied: file is outside the allowed directory",
    });
  }

  // Check if file exists and is a file (not a directory)
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      return res.status(404).json({
        error: "File not found",
      });
    }

    if (!stats.isFile()) {
      return res.status(400).json({
        error: "Path does not point to a file",
      });
    }

    // Send the file
    res.download(fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({
          error: "Error downloading file",
        });
      }
    });
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "File download server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`File download server running on http://localhost:${PORT}`);
  console.log(`Base download directory: ${BASE_DOWNLOAD_DIR}`);
  console.log(
    `Try downloading the test file: http://localhost:${PORT}/download/test.txt`
  );
});