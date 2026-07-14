const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const allowedLogFiles = ['access.log', 'error.log'];

app.use(express.static('public'));

app.get('/api/logfiles', (req, res) => {
    const files = allowedLogFiles.map(file => ({ filename: file }));
    res.json(files);
});

app.get('/api/logfile', (req, res) => {
    const { filename } = req.query;
    if (!allowedLogFiles.includes(filename)) {
        return res.status(403).send('Access denied');
    }

    const filePath = path.join(__dirname, 'logs', filename);
    if (!path.isAbsolute(filePath) || !filePath.startsWith(path.join(__dirname, 'logs'))) {
        return res.status(400).send('Invalid file path');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading log file');
        }
        res.send(data);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});