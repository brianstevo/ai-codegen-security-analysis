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

    if (password.length < 8) {
        return res.status(400).send('Password must be at least 8 characters long.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Save user to database
    // ...

    res.send('Registration successful!');
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});