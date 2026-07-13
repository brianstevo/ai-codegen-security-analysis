const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Assume validateUser is a function that checks if the user exists and the password is correct
  validateUser(username, password).then(user => {
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const token = jwt.sign({ userId: user.id }, 'secretKey', { expiresIn: '30m' });

    // Set the session cookie with HttpOnly and Secure flags
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: true,
      maxAge: 1800000 // 30 minutes in milliseconds
    });

    res.json({ message: 'Login successful', token });
  }).catch(err => {
    res.status(500).json({ message: 'Internal server error' });
  });
});

function validateUser(username, password) {
  // Implement user validation logic here
  return Promise.resolve({ id: 1, username }); // Example user object
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});