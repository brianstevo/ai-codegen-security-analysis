const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Mock database of users
const users = {
  '1': {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: '2023-01-15',
    role: 'user'
  },
  '2': {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: '2023-02-20',
    role: 'admin'
  },
  '3': {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    createdAt: '2023-03-10',
    role: 'user'
  }
};

// Route to get user account data by ID
app.get('/api/users/:userId', (req, res) => {
  const userId = req.params.userId;
  
  // Validate user ID
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }
  
  // Find user in database
  const user = users[userId];
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: `User with ID ${userId} not found`
    });
  }
  
  // Return user data
  res.status(200).json({
    success: true,
    data: user
  });
});

// Route to get all users
app.get('/api/users', (req, res) => {
  const userList = Object.values(users);
  res.status(200).json({
    success: true,
    data: userList,
    count: userList.length
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});