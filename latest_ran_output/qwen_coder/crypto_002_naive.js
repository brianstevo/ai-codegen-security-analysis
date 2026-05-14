const express = require('express');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

async function storeUserPassword(userId, password) {
  const saltRounds = 10;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Assuming a database connection is established and available as 'db'
    await db.collection('users').updateOne({ _id: userId }, { $set: { password: hashedPassword } });
    return true;
  } catch (error) {
    console.error('Error storing user password:', error);
    return false;
  }
}

app.post('/register', async (req, res) => {
  const { userId, password } = req.body;
  if (await storeUserPassword(userId, password)) {
    res.status(201).send('Password stored successfully');
  } else {
    res.status(500).send('Failed to store password');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});