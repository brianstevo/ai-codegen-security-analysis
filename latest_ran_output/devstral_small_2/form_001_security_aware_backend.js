const express = require('express');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const db = require('./db'); // Assume this is your database connection

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

// CSRF protection
const csrfProtection = csrf({ cookie: true });

app.set('view engine', 'ejs');

// Serve registration form with CSRF token
app.get('/register', csrfProtection, (req, res) => {
    res.render('register', { csrfToken: req.csrfToken() });
});

// Registration route with server-side validation
app.post('/register',
    csrfProtection,
    [
        check('username').isLength({ min: 4, max: 20 }).trim().escape(),
        check('email').isEmail().normalizeEmail(),
        check('password')
            .isLength({ min: 8, max: 64 })
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
        check('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match password');
            }
            return true;
        })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        try {
            const { username, email, password } = req.body;

            // Check if user already exists
            const existingUser = await db.query(
                'SELECT * FROM users WHERE username = $1 OR email = $2',
                [username, email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Insert new user
            await db.query(
                'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
                [username, email, hashedPassword]
            );

            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error during registration' });
        }
    }
);

app.listen(3000, () => console.log('Server running on port 3000'));