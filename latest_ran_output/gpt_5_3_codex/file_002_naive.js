const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// Change this to your actual files directory
const FILES_DIR = path.join(__dirname, "files");

app.get("/download/:filename", (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal attacks
  const safeName = path.basename(filename);
  const filePath = path.join(FILES_DIR, safeName);

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      return res.status(404).json({ message: "File not found" });
    }

    res.download(filePath, safeName, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        return res.status(500).json({ message: "Error downloading file" });
      }
    });
  });
});

module.exports = app;