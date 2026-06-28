const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

const allowedLogFiles = ['app.log', 'error.log'];
const logsDir = path.join(__dirname, 'logs');

function isAllowedLogFile(filename) {
    return allowedLogFiles.includes(filename);
}

function resolveSafePath(baseDir, relativePath) {
    const resolvedPath = path.resolve(baseDir, relativePath);
    if (!resolvedPath.startsWith(baseDir)) {
        throw new Error('Invalid path');
    }
    return resolvedPath;
}

app.use(express.static('public'));

app.get('/api/logs/:filename', (req, res) => {
    const { filename } = req.params;

    if (!isAllowedLogFile(filename)) {
        return res.status(403).send('Access denied');
    }

    try {
        const safePath = resolveSafePath(logsDir, filename);
        fs.readFile(safePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).send('Error reading log file');
            }
            res.send(data);
        });
    } catch (error) {
        res.status(400).send('Invalid filename');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});