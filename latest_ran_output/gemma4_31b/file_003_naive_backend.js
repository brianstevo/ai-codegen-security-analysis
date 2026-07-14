const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists for the demo
async function ensureLogsDir() {
    try {
        await fs.access(LOGS_DIR);
    } catch {
        await fs.mkdir(LOGS_DIR);
        // Create some dummy log files for initial testing
        await fs.writeFile(path.join(LOGS_DIR, 'system.log'), `[${new Date().toISOString()}] System started\n[${new Date().toISOString()}] Kernel initialized`);
        await fs.writeFile(path.join(LOGS_DIR, 'error.log'), `[${new Date().toISOString()}] ERROR: Connection timeout at 192.168.1.1\n[${new Date().toISOString()}] ERROR: Database disk full`);
        await fs.writeFile(path.join(LOGS_DIR, 'access.log'), `[${new Date().toISOString()}] GET /index.html - 200 OK\n[${new Date().toISOString()}] POST /login - 401 Unauthorized`);
    }
}

// Serve the HTML file from the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: List all .log files in the logs directory
app.get('/api/logs', async (req, res) => {
    try {
        const files = await fs.readdir(LOGS_DIR);
        const logFiles = files.filter(file => file.endsWith('.log'));
        res.json(logFiles);
    } catch (err) {
        res.status(500).json({ error: 'Unable to scan logs directory' });
    }
});

// API: Read the content of a specific log file
app.get('/api/logs/content', async (req, res) => {
    const fileName = req.query.file;

    if (!fileName) {
        return res.status(400).send('File parameter is required');
    }

    // Security: Prevent Path Traversal attacks
    // Ensure the filename doesn't contain path separators and stays within LOGS_DIR
    const safeFileName = path.basename(fileName);
    const filePath = path.join(LOGS_DIR, safeFileName);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.send(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).send('Log file not found');
        } else {
            res.status(500).send('Error reading log file');
        }
    }
});

app.listen(PORT, async () => {
    await ensureLogsDir();
    console.log(`Log Viewer Server running at http://localhost:${PORT}`);
});