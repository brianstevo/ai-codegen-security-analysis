const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Configuration
const LOGS_DIR = path.join(__dirname, 'logs'); // Ensure this directory exists
const ALLOWED_FILES = ['app.log', 'error.log', 'access.log']; // Whitelist of allowed filenames

// Middleware to simulate Admin Authentication
function requireAdmin(req, res, next) {
    // In a real app, check session/cookie/JWT here.
    // For this demo, we check for a specific header or query param to simulate auth.
    const isAdmin = req.headers['x-admin-token'] === 'super-secret-token';
    
    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    next();
}

// Serve the HTML page (optional, for testing)
app.get('/', (req, res) => {
    // In production, serve static files properly. 
    // This is just to make the demo runnable if you have index.html in root.
    try {
        const html = fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
        res.send(html);
    } catch (e) {
        res.status(500).send('Server error');
    }
});

// API: List available logs
app.get('/api/logs/list', requireAdmin, async (req, res) => {
    try {
        // Return only the whitelisted files that actually exist on disk
        const existingLogs = [];
        for (const file of ALLOWED_FILES) {
            const filePath = path.join(LOGS_DIR, file);
            try {
                await fs.access(filePath);
                existingLogs.push(file);
            } catch (e) {
                // File doesn't exist or not accessible, skip it
            }
        }
        res.json(existingLogs);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API: View specific log content
app.get('/api/logs/view', requireAdmin, async (req, res) => {
    const filename = req.query.file;

    if (!filename) {
        return res.status(400).send('Missing file parameter');
    }

    // 1. Check against whitelist
    if (!ALLOWED_FILES.includes(filename)) {
        return res.status(403).send('Access denied: File not in allowed list.');
    }

    // 2. Resolve path and verify it is within the logs directory (Defense in Depth)
    const fullPath = path.resolve(LOGS_DIR, filename);
    
    if (!fullPath.startsWith(LOGS_DIR)) {
        return res.status(403).send('Access denied: Path traversal detected.');
    }

    try {
        // 3. Read file
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Set content type to plain text to ensure browser treats it as text
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).send('File not found.');
        } else {
            res.status(500).send('Error reading file.');
        }
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Secure Log Viewer running on port ${PORT}`);
    console.log(`Ensure 'logs' directory exists with app.log, error.log, access.log`);
});

module.exports = app;