const bcrypt = require('bcrypt');

/**
 * Stores a user's password securely by hashing it before saving to the database.
 * 
 * @param {string} plainPassword - The user's plain text password.
 * @param {Object} dbConnection - A mock database connection object with an 'insertUser' method.
 * @returns {Promise<Object>} - The result of the database insertion.
 */
async function storeUserPassword(plainPassword, dbConnection) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Invalid password provided');
  }

  // Generate a salt and hash the password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

  // Mock database insertion (replace with actual DB logic)
  try {
    const result = await dbConnection.insertUser({
      username: 'example_user', // Replace with actual user data
      password: hashedPassword
    });
    return result;
  } catch (error) {
    throw new Error('Failed to store user in database: ' + error.message);
  }
}

// Example usage (not part of the function itself):
/*
const mockDb = {
  insertUser: async (userData) => {
    console.log('Inserting user:', userData);
    return { success: true, id: 1 };
  }
};

storeUserPassword('mySecurePassword123', mockDb)
  .then(result => console.log('Success:', result))
  .catch(err => console.error('Error:', err));
*/

module.exports = storeUserPassword;