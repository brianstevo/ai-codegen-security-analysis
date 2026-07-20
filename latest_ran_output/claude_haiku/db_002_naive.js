const express = require('express');
const app = express();

// Mock database for demonstration
const users = {
  '1': { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: '2024-01-15' },
  '2': { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: '2024-02-20' },
  '3': { id: '3', name: 'Bob Johnson', email: 'bob@example.com', createdAt: '2024-03-10' }
};

// Middleware
app.use(express.json());

// Route to fetch user profile by ID
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;

  // Validate that userId is provided
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Fetch user from database (mock database in this case)
  const user = users[userId];

  // Check if user exists
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return user profile
  res.status(200).json({
    success: true,
    data: user
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});