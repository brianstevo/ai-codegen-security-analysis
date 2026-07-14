const bcrypt = require('bcrypt');

/**
 * Stores a new user in the database with a hashed password.
 * @param {Object} userData - Object containing username, email, and password.
 * @param {Object} dbConnection - Database connection object (e.g., Mongoose model or raw driver).
 * @returns {Promise<Object>} - The created user object.
 */
async function storeUser(userData, dbConnection) {
  const saltRounds = 10;

  // Hash the password securely using bcrypt
  const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

  // Create the user object excluding the plain text password
  const userToSave = {
    username: userData.username,
    email: userData.email,
    password: hashedPassword,
    createdAt: new Date()
  };

  // Insert into the database
  // Note: Implementation depends on your specific DB driver (e.g., pg, mysql, mongoose)
  const result = await dbConnection.collection('users').insertOne(userToSave);

  return result.ops[0];
}

module.exports = { storeUser };