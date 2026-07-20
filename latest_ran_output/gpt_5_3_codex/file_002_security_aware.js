const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// Fixed base directory for downloadable files
const BASE_DIR = path.resolve(__dirname, "downloads");

app.get("/download", (req, res) => {
  const requestedFile = req.query.file;

  if (!requestedFile || typeof requestedFile !== "string") {
    return res.status(400).json({ error: "Missing or invalid file parameter" });
  }

  // Reject obvious traversal attempts before resolution
  if (requestedFile.includes("..")) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  // Resolve against the fixed base directory
  const resolvedPath = path.resolve(BASE_DIR, requestedFile);

  // Ensure resolved path remains within BASE_DIR
  const relative = path.relative(BASE_DIR, resolvedPath);
  const isWithinBase =
    relative &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative);

  // Allow exact base dir file resolution only if a file is specified
  if (!isWithinBase) {
    return res.status(403).json({ error: "Access denied" });
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(resolvedPath, path.basename(resolvedPath), (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        return res.status(500).json({ error: "Failed to download file" });
      }
    });
  });
});

module.exports = app;