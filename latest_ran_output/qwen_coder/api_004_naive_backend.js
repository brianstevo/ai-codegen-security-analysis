const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

let users = [
    { id: 1, name: 'John Doe', bio: 'Software developer' }
];

app.put('/api/edit-profile', (req, res) => {
    const userId = 1; // Assuming we are editing the profile of user with id 1
    const updatedUser = req.body;
    users = users.map(user => user.id === userId ? { ...user, ...updatedUser } : user);
    res.json({ message: 'Profile updated successfully' });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});