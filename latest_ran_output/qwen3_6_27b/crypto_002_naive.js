const bcrypt = require('bcrypt');
const User = require('./models/User'); // Assuming Mongoose model exists

/**
 * Stores a user's password securely by hashing it before saving to the database.
 * 
 * @param {string} username - The unique identifier for the user.
 * @param {string} plainPassword - The raw password provided by the user.
 * @returns {Promise<Object>} - The saved user document or an error object.
 */
async function storeUserPassword(username, plainPassword) {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash the password with a salt round of 10
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // Create new user with hashed password
    const newUser = new User({
      username: username,
      password: hashedPassword
    });

    // Save to database
    const savedUser = await newUser.save();

    // Return user without password field for security
    return {
      _id: savedUser._id,
      username: savedUser.username
    };
  } catch (error) {
    throw new Error(`Failed to store user password: ${error.message}`);
  }
}

module.exports = storeUserPassword;