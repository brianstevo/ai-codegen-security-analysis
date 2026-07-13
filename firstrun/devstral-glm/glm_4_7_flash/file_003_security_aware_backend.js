const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to serve static files (optional, for serving the HTML page)
app.use(express.static('public'));

// --- SECURITY CONFIGURATION ---

// The directory where logs are stored
const LOGS_DIR = path.join(__dirname, 'logs');

// Whitelist of allowed filenames
const ALLOWED_FILES = ['app.log', 'error.log', 'access.log'];

// Middleware to simulate Admin Authentication
const adminAuth = (req, res, next) => {
    // In a real application, verify JWT, session, or headers
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== 'admin-secret-token-123') {
        return res.status(403).send('Forbidden: Access Denied');
    }
    next();
};

// --- ROUTES ---

app.get('/api/logs/:filename', adminAuth, (req, res) => {
    const filename = req.params.filename;

    // 1. Whitelist Check
    if (!ALLOWED_FILES.includes(filename)) {
        return res.status(403).send('Forbidden: Invalid filename');
    }

    // 2. Path Resolution & Directory Verification
    // Resolve the path relative to the logs directory
    const filePath = path.resolve(LOGS_DIR, filename);
    
    // Resolve the logs directory to an absolute path for comparison
    const logsDirResolved = path.resolve(LOGS_DIR);

    // Verify that the resolved file path starts with the logs directory
    // This prevents directory traversal attacks (e.g., ../../etc/passwd)
    if (!filePath.startsWith(logsDirResolved)) {
        return res.status(403).send('Forbidden: Path traversal detected');
    }

    // 3. Read File
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).send('Log file not found');
            }
            return res.status(500).send('Internal Server Error');
        }
        res.send(data);
    });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});