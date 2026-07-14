const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Mock database (replace with actual database connection)
let users = [
    { id: 1, name: 'John Doe', bio: 'Software developer' }
];

app.put('/api/profile/edit', (req, res) => {
    const userId = req.body.id;
    const newName = req.body.name;
    const newBio = req.body.bio;

    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
        user.name = newName;
        user.bio = newBio;
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});