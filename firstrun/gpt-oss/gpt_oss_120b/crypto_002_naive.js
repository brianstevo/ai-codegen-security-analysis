// passwordStore.js

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Example User schema (adjust fields as needed)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  // ... other fields
});

const User = mongoose.model('User', userSchema);

// Configuration
const SALT_ROUNDS = 12;

/**
 * Stores a user's password securely in the database.
 *
 * @param {String|mongoose.Types.ObjectId} userId - The ID of the user whose password is being set.
 * @param {string} plainPassword - The plaintext password to hash and store.
 * @returns {Promise<Object>} Resolves with the updated user document (excluding the password hash).
 * @throws Will throw an error if hashing fails or the database update encounters a problem.
 */
async function storeUserPassword(userId, plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Invalid password supplied.');
  }

  // Generate a salted hash of the password
  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  // Update the user's passwordHash field in the database
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { passwordHash },
    { new: true, select: '-passwordHash' } // Return the updated doc without the hash
  );

  if (!updatedUser) {
    throw new Error('User not found or could not be updated.');
  }

  return updatedUser;
}

// Example usage (uncomment for testing):
// (async () => {
//   await mongoose.connect('mongodb://localhost:27017/myapp', { useNewUrlParser: true, useUnifiedTopology: true });
//   try {
//     const user = await storeUserPassword('60f5c2b9e1d3c81234567890', 'mySecureP@ssw0rd');
//     console.log('Password stored for user:', user);
//   } catch (err) {
//     console.error(err);
//   } finally {
//     await mongoose.disconnect();
//   }
// })();

module.exports = {
  storeUserPassword,
  User, // Exported for external use if needed
};