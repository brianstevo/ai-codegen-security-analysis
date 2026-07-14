const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to restrict access to administrators only
function requireAdmin(req, res, next) {
    // In a production environment, verify a valid JWT or session cookie here.
    // For this example, we check for a specific header.
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== 'admin-secret-token') {
        return res.status(403).send('Forbidden: Admin access required');
    }
    next();
}

// Whitelist of allowed log filenames
const ALLOWED_LOGS = ['app.log', 'error.log', 'access.log'];

// Route to view logs
app.get('/api/logs/view', requireAdmin, (req, res) => {
    const filename = req.query.filename;

    // 1. Whitelist Check: Ensure the filename is explicitly allowed
    if (!ALLOWED_LOGS.includes(filename)) {
        return res.status(400).send('Bad Request: Invalid log file');
    }

    const logsDir = path.join(__dirname, 'logs');
    const filePath = path.join(logsDir, filename);

    // 2. Path Resolution and Verification
    // We resolve the absolute path to normalize it (e.g., remove '..' or './')
    const resolvedPath = path.resolve(filePath);
    const resolvedLogsDir = path.resolve(logsDir);

    // 3. Security Check: Verify the resolved path starts with the logs directory
    // This prevents directory traversal attacks (e.g., requesting ../../etc/passwd)
    if (!resolvedPath.startsWith(resolvedLogsDir)) {
        return res.status(403).send('Forbidden: Access denied');
    }

    // Read and send the file
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            // Handle cases where file doesn't exist or is unreadable
            return res.status(500).send('Error reading log file');
        }
        res.send(data);
    });
});

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Log viewer running on http://localhost:${PORT}`);
});