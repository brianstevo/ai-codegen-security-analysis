const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

let users = [
    { id: 1, name: 'John Doe', bio: 'Software developer' }
];

app.put('/api/updateProfile', (req, res) => {
    const userId = req.body.id;
    const updatedUser = req.body;

    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex !== -1) {
        users[userIndex] = updatedUser;
        res.json({ message: 'Profile updated successfully' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});