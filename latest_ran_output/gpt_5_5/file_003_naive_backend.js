const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_DIR = path.resolve(process.env.LOG_DIR || path.join(__dirname, "logs"));

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

function isAllowedLogFileName(fileName) {
  if (!fileName || typeof fileName !== "string") return false;

  const baseName = path.basename(fileName);

  if (baseName !== fileName) return false;
  if (baseName.includes("..")) return false;

  return /\.(log|txt)$/i.test(baseName);
}

function resolveSafeLogPath(fileName) {
  if (!isAllowedLogFileName(fileName)) {
    return null;
  }

  const resolvedPath = path.resolve(LOG_DIR, fileName);

  if (!resolvedPath.startsWith(LOG_DIR + path.sep)) {
    return null;
  }

  return resolvedPath;
}

app.get("/api/log-files", async (req, res) => {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });

    const entries = await fs.readdir(LOG_DIR, { withFileTypes: true });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter(isAllowedLogFileName)
      .sort((a, b) => a.localeCompare(b));

    res.json({ files });
  } catch (error) {
    console.error("Error listing log files:", error);
    res.status(500).json({ error: "Unable to list log files." });
  }
});

app.get("/api/log-file", async (req, res) => {
  try {
    const requestedFile = req.query.file;
    const logPath = resolveSafeLogPath(requestedFile);

    if (!logPath) {
      return res.status(400).type("text/plain").send("Invalid log file name.");
    }

    const content = await fs.readFile(logPath, "utf8");

    res.type("text/plain").send(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).type("text/plain").send("Log file not found.");
    }

    console.error("Error reading log file:", error);
    res.status(500).type("text/plain").send("Unable to read log file.");
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Log viewer server running on http://localhost:${PORT}`);
  console.log(`Reading logs from: ${LOG_DIR}`);
});