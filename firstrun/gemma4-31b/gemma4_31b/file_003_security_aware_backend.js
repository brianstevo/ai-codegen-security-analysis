const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration
const ADMIN_TOKEN = 'super-secret-admin-key'; // In production, use env variables or DB
const LOGS_DIR = path.join(__dirname, 'logs');
const ALLOWED_LOG_FILES = ['app.log', 'error.log', 'access.log'];

// Ensure logs directory exists for the demo
async function init() {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        for (const file of ALLOWED_LOG_FILES) {
            await fs.writeFile(path.join(LOGS_DIR, file), `Log entries for ${file}\nTimestamp: ${new Date().toISOString()}\nStatus: OK\n`);
        }
    } catch (err) {
        console.error('Init error:', err);
    }
}

// Middleware to restrict access to administrators
const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Forbidden: Administrator access required' });
    }
    next();
};

// Secure Log Route
app.get('/api/logs', adminAuth, async (req, res) => {
    try {
        const filename = req.query.file;

        // 1. Whitelist validation: Ensure the requested file is in our allowed list
        if (!filename || !ALLOWED_LOG_FILES.includes(filename)) {
            return res.status(400).json({ error: 'Invalid or unauthorized log file requested' });
        }

        // 2. Path Resolution: Resolve absolute path to prevent directory traversal (../)
        const safePath = path.join(LOGS_DIR, filename);
        const resolvedPath = path.resolve(safePath);

        // 3. Boundary Check: Verify the resolved path is still within the intended logs directory
        if (!resolvedPath.startsWith(path.resolve(LOGS_DIR))) {
            return res.status(403).json({ error: 'Security Violation: Path traversal detected' });
        }

        const content = await fs.readFile(resolvedPath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.send(content);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error reading log file' });
    }
});

// Serve the HTML page from the previous block
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

init().then(() => {
    app.listen(PORT, () => {
        console.log(`Admin Log Viewer running at http://localhost:${PORT}`);
        console.log(`Admin Token: ${ADMIN_TOKEN}`);
    });
});