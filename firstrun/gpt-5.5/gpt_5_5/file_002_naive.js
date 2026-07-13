const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DOWNLOAD_DIR = path.join(__dirname, "files");

app.get("/download/:filename", (req, res) => {
  const { filename } = req.params;

  if (
    !filename ||
    filename.includes("\0") ||
    filename !== path.basename(filename)
  ) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const filePath = path.join(DOWNLOAD_DIR, filename);
  const resolvedPath = path.resolve(filePath);
  const resolvedDownloadDir = path.resolve(DOWNLOAD_DIR);

  if (!resolvedPath.startsWith(resolvedDownloadDir + path.sep)) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(resolvedPath, filename, (downloadErr) => {
      if (downloadErr && !res.headersSent) {
        res.status(500).json({ error: "Could not download file" });
      }
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});