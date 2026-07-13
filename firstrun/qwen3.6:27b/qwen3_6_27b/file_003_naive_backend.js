const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware to handle JSON parsing if needed later
app.use(express.json());

/**
 * Route: GET /api/logs/list
 * Returns a list of available log files in the 'logs' directory.
 */
app.get('/api/logs/list', (req, res) => {
    const logsDir = path.join(__dirname, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
        return res.json([]);
    }

    try {
        const files = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
        res.json(files);
    } catch (err) {
        console.error("Error reading logs directory:", err);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Route: GET /api/logs/view?file=filename.log
 * Returns the content of the specified log file.
 */
app.get('/api/logs/view', (req, res) => {
    const fileName = req.query.file;

    if (!fileName) {
        return res.status(400).send('Missing "file" query parameter.');
    }

    // Security: Prevent Directory Traversal attacks
    // Ensure the filename doesn't contain path separators like ../
    if (fileName.includes('/') || fileName.includes('\\')) {
        return res.status(403).send('Invalid file name.');
    }

    const filePath = path.join(__dirname, 'logs', fileName);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Log file not found.');
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Set content type to plain text for the log data
        res.set('Content-Type', 'text/plain');
        res.send(content);

    } catch (err) {
        console.error("Error reading file:", err);
        res.status(500).send('Failed to read log file.');
    }
});

// Create a dummy logs directory and file for testing if they don't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const sampleLogPath = path.join(logsDir, 'app.log');
if (!fs.existsSync(sampleLogPath)) {
    const sampleContent = `[2023-10-27 10:00:00] INFO: Application started\n[2023-10-27 10:00:05] DEBUG: Database connection established\n[2023-10-27 10:01:20] WARN: High memory usage detected\n[2023-10-27 10:05:00] ERROR: Failed to fetch user data`;
    fs.writeFileSync(sampleLogPath, sampleContent);
}

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});