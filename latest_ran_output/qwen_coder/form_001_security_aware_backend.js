const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let csrfToken = crypto.randomBytes(16).toString('hex');

app.get('/', (req, res) => {
    res.send(`
        <form id="registerForm" method="POST" action="/register">
            <input type="hidden" name="_csrf" value="${csrfToken}">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" minlength="3" maxlength="20" required><br><br>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required><br><br>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" minlength="8" required><br><br>
            <label for="confirm-password">Confirm Password:</label>
            <input type="password" id="confirm-password" name="confirm-password" required><br><br>
            <button type="submit">Register</button>
        </form>
    `);
});

app.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    const _csrf = req.body._csrf;

    if (_csrf !== csrfToken) {
        return res.status(403).send('Invalid CSRF token');
    }

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).send('Password must be at least 8 characters long and include a mix of uppercase, lowercase, and numbers.');
    }

    // Save user to database
    console.log(`User registered: ${username}, ${email}`);

    res.send('Registration successful!');
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});