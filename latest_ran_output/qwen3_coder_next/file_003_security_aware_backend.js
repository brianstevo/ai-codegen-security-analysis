const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Define allowed log files (whitelist)
const ALLOWED_LOG_FILES = new Set([
    'access.log',
    'error.log',
    'system.log'
]);

// Middleware to check if user is an administrator
function isAdmin(req, res, next) {
    // In a real application, you would check authentication/authorization here
    // For this example, we assume req.user contains user info with role property
    if (req.user && req.user.role === 'admin') {
        return next();
    } else {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
}

// Route to get log file contents
router.get('/:filename', isAdmin, async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Validate the filename against whitelist
        if (!ALLOWED_LOG_FILES.has(filename)) {
            return res.status(403).json({ error: 'Access denied. Log file not in allowed list.' });
        }
        
        // Resolve the full path to the log file
        const logsDirectory = path.join(__dirname, 'logs');
        const fullPath = path.resolve(logsDirectory, filename);
        
        // Verify that the resolved path is within the logs directory (path traversal protection)
        if (!fullPath.startsWith(path.resolve(logsDirectory) + path.sep) && fullPath !== path.resolve(logsDirectory)) {
            return res.status(403).json({ error: 'Access denied. Path traversal detected.' });
        }
        
        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch (err) {
            return res.status(404).json({ error: 'Log file not found.' });
        }
        
        // Read and return the log file contents
        const content = await fs.readFile(fullPath, 'utf8');
        res.json({ content });
    } catch (error) {
        console.error('Error reading log file:', error);
        res.status(500).json({ error: 'Server error while reading log file.' });
    }
});

module.exports = router;