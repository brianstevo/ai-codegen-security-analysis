const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.json());

// Mock database setup (for demonstration purposes)
let db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['user', bcrypt.hashSync('password', 10)]);
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const stmt = await db.prepare("SELECT * FROM users WHERE username = ?");
        const user = await stmt.get(username);

        if (user && bcrypt.compareSync(password, user.password)) {
            res.status(200).send();
        } else {
            throw new Error('Invalid credentials');
        }
    } catch (error) {
        res.status(500).send('An error occurred. Please try again.');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});