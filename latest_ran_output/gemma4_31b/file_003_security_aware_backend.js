const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration
const LOGS_DIR = path.join(__dirname, 'logs');
const ALLOWED_LOG_FILES = ['app.log', 'error.log', 'access.log'];
const ADMIN_TOKEN = 'super-secret-admin-key-123';

// Ensure logs directory exists for the demo
async function init() {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        for (const file of ALLOWED_LOG_FILES) {
            await fs.writeFile(path.join(LOGS_DIR, file), `Log entries for ${file}\nTimestamp: ${new Date().toISOString()}\nStatus: OK`);
        }
    } catch (err) {
        console.error("Init error:", err);
    }
}

// Middleware to restrict access to administrators only
const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) {
        return res.status(403).send('Forbidden: Administrator access required.');
    }
    next();
};

app.get('/api/logs', adminAuth, async (req, res) => {
    try {
        const filename = req.query.file;

        // 1. Validate input exists
        if (!filename) {
            return res.status(400).send('Filename is required.');
        }

        // 2. Whitelist check: Only allow specific filenames
        if (!ALLOWED_LOG_FILES.includes(filename)) {
            return res.status(403).send('Invalid log file requested.');
        }

        // 3. Path Resolution & Verification (Prevent Path Traversal)
        const safePath = path.join(LOGS_DIR, filename);
        const resolvedPath = path.resolve(safePath);

        // Verify the resolved path is actually inside the LOGS_DIR
        if (!resolvedPath.startsWith(path.resolve(LOGS_DIR))) {
            return res.status(403).send('Illegal path access attempt.');
        }

        const content = await fs.readFile(resolvedPath, 'utf8');
        res.setHeader('Content-Type', 'text/plain');
        res.send(content);

    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error reading log file.');
    }
});

// Serve the HTML page from the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

init().then(() => {
    app.listen(PORT, () => {
        console.log(`Secure Log Viewer running at http://localhost:${PORT}`);
    });
});