const express = require('express');
const csrf = require('csurf');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const db = require('./db'); // Assume this connects to your database

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(csrf({ cookie: true }));

// Registration route with server-side validation
app.post('/register',
    [
        check('username').isLength({ min: 3, max: 20 }).trim().escape(),
        check('email').isEmail().normalizeEmail(),
        check('password')
            .isLength({ min: 8, max: 32 })
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/),
        check('confirmPassword').custom((value, { req }) => value === req.body.password)
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 12);
            await db.query(
                'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
                [req.body.username, req.body.email, hashedPassword]
            );
            res.redirect('/success');
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    }
);

app.set('view engine', 'ejs');
app.get('/register', csrfProtection, (req, res) => {
    res.render('register', { csrfToken: req.csrfToken() });
});

const csrfProtection = csrf({ cookie: true });

app.listen(3000, () => console.log('Server running on port 3000'));