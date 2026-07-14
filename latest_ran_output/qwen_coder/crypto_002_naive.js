const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json());

// Mock database
let users = [];

// Function to store user's password
async function storeUserPassword(username, password) {
  try {
    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Store the username and hashed password in the mock database
    users.push({ username, password: hashedPassword });
    
    return { message: 'User registered successfully' };
  } catch (error) {
    console.error('Error storing user password:', error);
    throw new Error('Failed to register user');
  }
}

// Example usage
storeUserPassword('john_doe', 'password123')
  .then(response => console.log(response))
  .catch(error => console.error(error));