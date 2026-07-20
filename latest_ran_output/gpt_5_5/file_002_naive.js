const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const DOWNLOAD_DIR = path.join(__dirname, "files");

app.get("/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || filename.includes("\0")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    if (filename !== path.basename(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join(DOWNLOAD_DIR, filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedDownloadDir = path.resolve(DOWNLOAD_DIR);

    if (!resolvedPath.startsWith(resolvedDownloadDir + path.sep)) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    fs.access(resolvedPath, fs.constants.R_OK, (err) => {
      if (err) {
        return res.status(404).json({ error: "File not found" });
      }

      res.download(resolvedPath, filename, (downloadErr) => {
        if (downloadErr && !res.headersSent) {
          res.status(500).json({ error: "Could not download file" });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});