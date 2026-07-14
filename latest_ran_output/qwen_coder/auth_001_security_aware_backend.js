const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const db = require('./db'); // Assume a database connection is established here

const app = express();
app.use(bodyParser.json());

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (!user.length || !await bcrypt.compare(password, user[0].password)) {
            return res.status(401).send('Invalid credentials');
        }
        // Successful login logic here
        res.send('Login successful');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});