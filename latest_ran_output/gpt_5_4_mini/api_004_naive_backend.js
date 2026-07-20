const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Replace with your actual DB config
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Example auth middleware; replace with real auth/session handling
function requireAuth(req, res, next) {
  // In a real app, set req.user from session/JWT
  req.user = { id: 1 };
  next();
}

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { name, bio } = req.body;

    if (!name || !bio) {
      return res.status(400).json({ message: 'Name and bio are required.' });
    }

    const userId = req.user.id;

    const [result] = await pool.execute(
      'UPDATE users SET name = ?, bio = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), bio.trim(), userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, bio FROM users WHERE id = ?',
      [userId]
    );

    return res.json({
      message: 'Profile updated successfully.',
      profile: rows[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});