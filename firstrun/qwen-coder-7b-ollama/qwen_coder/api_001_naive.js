const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming you have a User model

router.get('/admin/dashboard', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

module.exports = router;