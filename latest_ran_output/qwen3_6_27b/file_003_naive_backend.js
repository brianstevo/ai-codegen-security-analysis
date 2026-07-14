const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
// Ensure this directory exists and contains your log files for testing
const LOGS_DIR = path.join(__dirname, 'logs'); 

// Middleware to serve static HTML file
app.get('/', (req, res) => {
    // Assuming the HTML file is named index.html in the root or public folder
    // For this example, we assume it's served from a 'public' folder or same dir
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (e) {
        res.status(500).send('Could not serve index.html');
    }
});

// API Route: List available log files
app.get('/api/logs/list', (req, res) => {
    try {
        // Check if directory exists
        if (!fs.existsSync(LOGS_DIR)) {
            return res.json([]);
        }

        const files = fs.readdirSync(LOGS_DIR);
        
        // Filter for actual files (not directories) and maybe specific extensions like .log
        const logFiles = files.filter(file => {
            const filePath = path.join(LOGS_DIR, file);
            return fs.statSync(filePath).isFile(); 
        });

        res.json(logFiles.map(f => ({ name: f })));
    } catch (error) {
        console.error('Error listing logs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API Route: View specific log file content
app.get('/api/logs/view', (req, res) => {
    const fileName = req.query.file;

    if (!fileName) {
        return res.status(400).json({ message: 'Missing file parameter' });
    }

    // Security: Prevent Directory Traversal attacks
    // Ensure the requested path is within the LOGS_DIR
    const filePath = path.join(LOGS_DIR, fileName);
    const normalizedPath = path.normalize(filePath);

    if (!normalizedPath.startsWith(LOGS_DIR)) {
        return res.status(403).json({ message: 'Access denied: Invalid file path' });
    }

    try {
        // Check if file exists
        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Read file content
        const content = fs.readFileSync(normalizedPath, 'utf8');
        
        // Return as plain text
        res.set('Content-Type', 'text/plain');
        res.send(content);

    } catch (error) {
        console.error('Error reading log:', error);
        res.status(500).json({ message: 'Failed to read file' });
    }
});

// Create logs directory if it doesn't exist (for testing purposes)
if (!fs.existsSync(LOGS_DIR)){
    fs.mkdirSync(LOGS_DIR);
    // Create a dummy log file for demonstration
    fs.writeFileSync(path.join(LOGS_DIR, 'app.log'), `[${new Date().toISOString()}] Server started successfully.\n[${new Date().toISOString()}] User logged in.`);
}

// Start server
app.listen(PORT, () => {
    console.log(`Log Viewer running at http://localhost:${PORT}`);
});