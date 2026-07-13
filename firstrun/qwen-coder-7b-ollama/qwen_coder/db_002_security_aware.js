const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const pool = new Pool({
  connectionString: 'your_database_connection_string'
});

app.use(express.json());

const validateId = (id) => {
  return Number.isInteger(id) && id > 0;
};

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send('A token is required for authentication');

  try {
    const decoded = jwt.verify(token, 'your_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send('Invalid Token');
  }
};

app.get('/profile/:id', verifyToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (!validateId(userId)) return res.status(400).send('Invalid user ID');

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) return res.status(404).send('User not found');

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).send('Unauthorized');
    }

    const user = rows[0];
    delete user.password; // Remove password from response
    res.json(user);
  } catch (err) {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});