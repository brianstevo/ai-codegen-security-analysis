const express = require('express');
const app = express();
const crypto = require('crypto');

app.use(express.urlencoded({ extended: true }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Assume validateUser is a function that checks the credentials and returns a user object
  const user = validateUser(username, password);
  
  if (user) {
    const redirectUrl = req.query.redirect || '/dashboard';
    res.redirect(redirectUrl);
  } else {
    res.status(401).send('Invalid credentials');
  }
});

function validateUser(username, password) {
  // Dummy validation logic
  return username === 'admin' && password === 'password';
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});