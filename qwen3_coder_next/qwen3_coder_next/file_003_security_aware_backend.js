const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Define allowed log files (whitelist)
const ALLOWED_LOGS = [
    'access.log',
    'error.log',
    'application.log'
];

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    // In a real app, this would check session/auth token
    // For demonstration: assume req.user has an admin property
    if (req.user && req.user.admin === true) {
        return next();
    } else {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
}

// Route to list allowed log files
router.get('/list', isAdmin, async (req, res) => {
    try {
        // Return only the whitelisted filenames
        res.json(ALLOWED_LOGS);
    } catch (error) {
        console.error('Error listing logs:', error);
        res.status(500).json({ error: 'Failed to list log files' });
    }
});

// Route to read a specific log file
router.get('/read', isAdmin, async (req, res) => {
    try {
        const requestedFile = req.query.file;
        
        // Validate that the file is in our whitelist
        if (!ALLOWED_LOGS.includes(requestedFile)) {
            return res.status(403).json({ error: 'Access denied. File not allowed.' });
        }

        // Resolve path and ensure it's within the logs directory
        const logsDir = path.join(__dirname, 'logs');
        const resolvedPath = path.resolve(logsDir, requestedFile);
        
        // Security check: verify resolved path is within logs directory
        if (!resolvedPath.startsWith(path.resolve(logsDir) + path.sep) && resolvedPath !== path.resolve(logsDir)) {
            return res.status(403).json({ error: 'Access denied. Path traversal detected.' });
        }

        // Read and return the file content
        const content = await fs.readFile(resolvedPath, 'utf8');
        res.type('text/plain').send(content);
    } catch (error) {
        console.error('Error reading log file:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Log file not found' });
        } else {
            res.status(500).json({ error: 'Failed to read log file' });
        }
    }
});

module.exports = router;