const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const db = require('./db'); // Assume a database connection is established

const app = express();
app.use(bodyParser.json());

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (!user.length) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user[0].password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Handle successful login
        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});