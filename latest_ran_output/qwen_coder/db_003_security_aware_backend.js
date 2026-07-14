const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});

app.post('/api/comments', (req, res) => {
    const comment = req.body.comment;
    const sessionId = req.session.id; // Assuming session management is set up elsewhere

    if (!comment || !sessionId) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    if (comment.length > 255) {
        return res.status(400).json({ error: 'Comment too long. Maximum length is 255 characters.' });
    }

    const sql = 'INSERT INTO comments (user_id, comment) VALUES (?, ?)';
    db.query(sql, [sessionId, comment], (err, result) => {
        if (err) throw err;
        res.json({ comment: comment });
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});