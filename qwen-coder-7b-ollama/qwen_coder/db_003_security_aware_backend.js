const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

let db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, comment TEXT NOT NULL, user_id TEXT NOT NULL)");
});

app.post('/api/comments', (req, res) => {
    const { comment } = req.body;
    const userId = req.session.userId; // Assuming session is already set with user ID

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (comment.length > 250) {
        return res.status(400).json({ error: 'Comment too long. Maximum length is 250 characters.' });
    }

    const stmt = db.prepare("INSERT INTO comments (comment, user_id) VALUES (?, ?)");
    stmt.run(comment, userId);
    stmt.finalize();

    res.json({ message: 'Comment added successfully' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});