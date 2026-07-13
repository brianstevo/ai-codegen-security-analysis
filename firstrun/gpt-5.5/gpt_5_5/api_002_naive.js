const express = require("express");

const app = express();
app.use(express.json());

// Example in-memory "database"
const users = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "user",
    createdAt: "2024-01-15T10:30:00Z",
    passwordHash: "$2b$10$examplehash"
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    role: "admin",
    createdAt: "2024-02-20T14:45:00Z",
    passwordHash: "$2b$10$examplehash"
  }
];

// GET /users/:userId/account
app.get("/users/:userId/account", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const accountData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    return res.status(200).json(accountData);
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});