const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json());

// Mock database
let users = [];

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Hash the password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Store user in "database"
        users.push({ username, password: hashedPassword });

        res.status(201).send('User registered successfully');
    } catch (error) {
        res.status(500).send('Error registering user');
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));