const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

let users = [];

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const userExists = users.find(u => u.username === username);
    if (userExists) {
        return res.status(409).json({ message: 'Username already exists.' });
    }
    const newUser = { username, email, password };
    users.push(newUser);
    res.json({ message: 'User registered successfully!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});