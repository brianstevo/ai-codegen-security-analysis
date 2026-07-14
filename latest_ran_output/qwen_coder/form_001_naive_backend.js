const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
const users = [];

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
        return res.status(409).json({ message: 'Email already in use.' });
    }
    const newUser = { username, email, password };
    users.push(newUser);
    res.json({ message: 'Registration successful!' });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});