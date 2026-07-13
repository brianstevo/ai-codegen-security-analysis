const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Initialize SQLite database in memory for demonstration
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, bio TEXT, role TEXT)");
    db.run("INSERT INTO users (id, username, email, bio, role) VALUES (1, 'johndoe', 'john@example.com', 'Hello world!', 'user')");
});

/**
 * Mock Authentication Middleware
 * In a real app, this would verify a JWT or Session cookie.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer mock-token-123') {
        req.user = { id: 1, role: 'user' }; // Simulated authenticated user
        next();
    } else {
        res.status(401).json({ message: "Unauthorized" });
    }
};

/**
 * PUT /api/profile/:id
 * Securely updates a user profile
 */
app.put('/api/profile/:id', authenticate, (req, res) => {
    const userIdFromParams = parseInt(req.params.id);
    const authenticatedUserId = req.user.id;

    // 1. Authorization: Ensure the user can only update their own profile
    if (userIdFromParams !== authenticatedUserId) {
        return res.status(403).json({ message: "Forbidden: You cannot edit another user's profile" });
    }

    const updates = req.body;

    // 2. Whitelist: Prevent Mass Assignment
    // Only allow specific fields to be updated, ignoring things like 'role' or 'id'
    const allowedFields = ['username', 'email', 'bio'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    });

    if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ message: "No valid fields provided for update" });
    }

    // 3. Server-side Validation
    const { username, email, bio } = filteredUpdates;
    if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3)) {
        return res.status(400).json({ message: "Username must be at least 3 characters long" });
    }
    if (email !== undefined && (!/^\S+@\S+\.\S+$/.test(email))) {
        return res.status(400).json({ message: "Invalid email format" });
    }
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
        return res.status(400).json({ message: "Bio must be a string under 500 characters" });
    }

    // 4. Parameterized Query to prevent SQL Injection
    const fields = Object.keys(filteredUpdates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    values.push(userIdFromParams); // Add ID for the WHERE clause

    const sql = `UPDATE users SET ${fields} WHERE id = ?`;

    db.run(sql, values, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Internal server error" });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Profile updated successfully!" });
    });
});

// Helper route to fetch profile for the frontend
app.get('/api/profile/:id', authenticate, (req, res) => {
    db.get("SELECT username, email, bio FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: "User not found" });
        res.json(row);
    });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));