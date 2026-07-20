const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const BASE_DIR = path.resolve(__dirname, "downloads");

app.get("/download", async (req, res) => {
  try {
    const requestedFile = req.query.file;

    if (typeof requestedFile !== "string" || requestedFile.length === 0) {
      return res.status(400).json({ error: "Missing file parameter" });
    }

    if (requestedFile.includes("..")) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (requestedFile.includes("\0")) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    const resolvedPath = path.resolve(BASE_DIR, requestedFile);
    const relativePath = path.relative(BASE_DIR, resolvedPath);

    const isWithinBaseDir =
      relativePath === "" ||
      (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

    if (!isWithinBaseDir) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stat = await fs.promises.stat(resolvedPath);

    if (!stat.isFile()) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.download(resolvedPath, path.basename(resolvedPath), (err) => {
      if (err && !res.headersSent) {
        return res.status(500).json({ error: "Download failed" });
      }
    });
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});