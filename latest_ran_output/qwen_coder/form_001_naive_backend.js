const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

// Mock database
let users = [];

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (users.find(user => user.username === username)) {
        return res.status(409).json({ message: 'Username already exists.' });
    }
    users.push({ username, email, password });
    res.json({ message: 'User registered successfully.' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});