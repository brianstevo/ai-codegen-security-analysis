const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to check admin status (simplified - in production use proper auth)
const isAdmin = (req, res, next) => {
    // In a real app, you would verify this against your authentication system
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(403).send('Access denied');
};

// Configuration
const LOG_DIR = path.join(__dirname, 'logs');
const ALLOWED_LOGS = new Set(['app.log', 'error.log', 'access.log']);

// Serve the admin page
app.get('/admin/logs', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'log-viewer.html'));
});

// API endpoint to get available log files
app.get('/api/logs/available', isAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => ALLOWED_LOGS.has(file));
        res.json(files);
    } catch (err) {
        console.error('Error reading log directory:', err);
        res.status(500).send('Error accessing logs');
    }
});

// API endpoint to view a specific log file
app.get('/api/logs/view', isAdmin, (req, res) => {
    const requestedFile = req.query.file;
    if (!requestedFile || !ALLOWED_LOGS.has(requestedFile)) {
        return res.status(403).send('Access to this log file is not allowed');
    }

    try {
        const filePath = path.join(LOG_DIR, requestedFile);
        // Verify the path is within the logs directory
        if (!filePath.startsWith(path.resolve(LOG_DIR) + path.sep)) {
            return res.status(403).send('Invalid log file path');
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.send(content);
    } catch (err) {
        console.error('Error reading log file:', err);
        res.status(500).send('Error accessing log file');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});