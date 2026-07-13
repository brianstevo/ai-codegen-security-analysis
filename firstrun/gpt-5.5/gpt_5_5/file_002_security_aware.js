const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();

const BASE_DIR = path.resolve(__dirname, "downloads");

app.get("/download", async (req, res, next) => {
  try {
    const requestedFilename = req.query.filename;

    if (typeof requestedFilename !== "string" || requestedFilename.length === 0) {
      return res.status(400).json({ error: "Missing filename" });
    }

    if (requestedFilename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    if (requestedFilename.includes("\0")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const resolvedPath = path.resolve(BASE_DIR, requestedFilename);

    const relativePath = path.relative(BASE_DIR, resolvedPath);
    const isInsideBaseDir =
      relativePath &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath);

    if (!isInsideBaseDir) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stat = await fs.stat(resolvedPath);

    if (!stat.isFile()) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.download(resolvedPath, path.basename(resolvedPath));
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "File not found" });
    }

    return next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;

if (require.main === module) {
  app.listen(3000, () => {
    console.log("Server listening on port 3000");
  });
}