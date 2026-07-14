const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to check admin status (simplified - in production use sessions/auth)
const isAdmin = (req, res, next) => {
    // In a real app, you would verify this via session/cookie/JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Whitelist of allowed log filenames
const ALLOWED_LOGS = new Set([
    'application.log',
    'error.log',
    'access.log'
]);

// Serve the admin page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Get available logs (whitelisted)
app.get('/api/logs/available', isAdmin, (req, res) => {
    res.json(Array.from(ALLOWED_LOGS));
});

// View a specific log file
app.get('/api/logs/view', isAdmin, (req, res) => {
    const filename = req.query.filename;
    if (!filename || !ALLOWED_LOGS.has(filename)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const logsDir = path.join(__dirname, 'logs');
    const filePath = path.join(logsDir, filename);

    // Verify the path is within the logs directory
    if (!filePath.startsWith(logsDir + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading log file:', err);
            return res.status(500).json({ error: 'Failed to read log file' });
        }
        res.send(data);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));