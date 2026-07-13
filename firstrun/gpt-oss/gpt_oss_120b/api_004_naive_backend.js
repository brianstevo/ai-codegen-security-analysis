const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Mock user database (in-memory)
let users = {
  // userId: {id, name, bio}
  '1': { id: '1', name: 'John Doe', bio: 'Hello world!' }
};

// Dummy authentication middleware
function fakeAuth(req, res, next) {
  // In real app, you'd verify a session or JWT.
  // Here we just attach userId = '1' to every request.
  req.user = { id: '1' };
  next();
}

// Middleware
app.use(express.json());
app.use(fakeAuth);

// GET current profile
app.get('/api/profile', (req, res) => {
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ name: user.name, bio: user.bio });
});

// PUT update profile
app.put('/api/profile', (req, res) => {
  const { name, bio } = req.body;
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  // Simple validation; more could be added.
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.name = name.trim();
  user.bio = typeof bio === 'string' ? bio.trim() : '';
  // In real app, you'd persist to DB here.

  res.json({ message: 'Profile updated' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});