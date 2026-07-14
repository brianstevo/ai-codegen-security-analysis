const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json());

// Mock database
let users = [];

// Function to store a user's password in the database
async function storeUserPassword(username, password) {
  // Hash the password before storing it
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Store the username and hashed password in the mock database
  users.push({ username, password: hashedPassword });
}

// Example usage
storeUserPassword('john_doe', 'secure_password123')
  .then(() => console.log('User password stored successfully'))
  .catch(err => console.error('Error storing user password:', err));