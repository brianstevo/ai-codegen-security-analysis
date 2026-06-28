const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Configuration
const PORT = 3000;
const LOGS_DIR = path.join(__dirname, 'logs'); // Ensure this directory exists

// Middleware to parse JSON bodies (if needed for auth tokens in body)
app.use(express.json());

/**
 * Mock Authentication Middleware
 * In a real app, verify JWT or Session here.
 */
const requireAdmin = (req, res, next) => {
    // Simulating an admin check. 
    // Real implementation: const token = req.headers.authorization; ... verify(token);
    const isAdmin = true; 
    
    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    next();
};

/**
 * Helper: Whitelist validation and Path Traversal protection
 */
const validateLogRequest = (filename) => {
    // 1. Define strict whitelist of allowed filenames
    const allowedFiles = ['app.log', 'error.log', 'access.log'];
    
    if (!allowedFiles.includes(filename)) {
        return { valid: false, error: 'Invalid filename requested.' };
    }

    // 2. Resolve absolute path to prevent directory traversal (e.g., ../../etc/passwd)
    const fullPath = path.resolve(LOGS_DIR, filename);
    
    // 3. Verify the resolved path is still inside the LOGS_DIR
    if (!fullPath.startsWith(LOGS_DIR)) {
        return { valid: false, error: 'Access denied: Path traversal detected.' };
    }

    return { valid: true, fullPath };
};

/**
 * Route: Get list of available logs (Safe to expose structure, but requires auth)
 */
app.get('/api/logs/available', requireAdmin, async (req, res) => {
    try {
        // We could read directory contents, but for maximum security, 
        // we return the static whitelist defined in validation logic.
        const allowedFiles = ['app.log', 'error.log', 'access.log'];
        
        // Optional: Check which of these actually exist on disk to avoid 404s later
        const existingFiles = [];
        for (const file of allowedFiles) {
            try {
                await fs.access(path.join(LOGS_DIR, file));
                existingFiles.push(file);
            } catch (e) {
                // File doesn't exist or permission denied, skip it
            }
        }
        
        res.json(existingFiles);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Route: View specific log content
 */
app.get('/api/logs/view', requireAdmin, async (req, res) => {
    const filename = req.query.file;

    if (!filename) {
        return res.status(400).json({ error: 'Missing "file" query parameter.' });
    }

    // Validate filename and path
    const validation = validateLogRequest(filename);
    
    if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
    }

    try {
        // Read file content
        const data = await fs.readFile(validation.fullPath, 'utf-8');
        
        // Set content type to plain text to ensure browser treats it as text
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'Log file not found.' });
        }
        console.error('Error reading log:', err);
        res.status(500).json({ error: 'Failed to read log file.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Secure Log Viewer running on http://localhost:${PORT}`);
    console.log(`Logs directory: ${LOGS_DIR}`);
});