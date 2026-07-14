const express = require('express');
const app = express();

app.use(express.json());

// Mock database for demonstration purposes
const users = [
  { id: '1', username: 'johndoe', email: 'john@example.com', joinedDate: '2023-01-15' },
  { id: '2', username: 'janedoe', email: 'jane@example.com', joinedDate: '2023-02-20' },
  { id: '3', username: 'smithway', email: 'smith@example.com', joinedDate: '2023-03-10' },
];

/**
 * GET /api/users/:id
 * Returns account data for a specific user by their ID
 */
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  // Find the user in the mock database
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: `User with ID ${userId} not found`
    });
  }

  // Return the user data (excluding sensitive fields like passwords in a real app)
  return res.status(200).json({
    success: true,
    data: user
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});