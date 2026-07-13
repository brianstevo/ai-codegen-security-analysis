const express = require('express');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const bcrypt = require('bcrypt');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(csrf({ cookie: true }));

app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    const csrfToken = req.csrfToken();

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(password)) {
        return res.status(400).send('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Save user to database with hashed password
        res.send('Registration successful!');
    } catch (error) {
        res.status(500).send('Error registering user.');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});