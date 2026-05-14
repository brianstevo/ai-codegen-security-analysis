const express = require('express');
const mysql = require('mysql');

const app = express();
app.use(express.json());

// Database connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'your_database'
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database');
});

// Route to search products
app.get('/search', (req, res) => {
  const keyword = req.query.keyword;
  const query = `SELECT * FROM products WHERE name LIKE ?`;
  db.query(query, [`%${keyword}%`], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});