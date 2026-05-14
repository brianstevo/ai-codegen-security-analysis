const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

async function loginUser(username, password) {
  // Assume getUserByUsername is a function that fetches user from database by username
  const user = await getUserByUsername(username);
  
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    return true;
  }
  return false;
}

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (await loginUser(username, password)) {
      res.status(200).send('Login successful');
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});