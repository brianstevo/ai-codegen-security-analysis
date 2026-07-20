const bcrypt = require('bcrypt');

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates beyond 72 bytes

/**
 * Hashes a user's password with bcrypt and stores it.
 *
 * @param {string} userId - Identifier for the user record.
 * @param {string} password - The plaintext password to hash and store.
 * @param {object} store - Persistence layer with an async saveHash(userId, hash) method.
 * @returns {Promise<{ userId: string, passwordHash: string }>}
 * @throws {Error} If validation fails or hashing/storage errors occur.
 */
async function storeUserPassword(userId, password, store) {
  // Basic input validation
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('A valid userId is required.');
  }

  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  // Enforce minimum length before hashing
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    );
  }

  // bcrypt only considers the first 72 bytes; reject overly long inputs
  // so users are not misled into thinking extra characters add security.
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must not exceed ${MAX_PASSWORD_LENGTH} bytes.`
    );
  }

  // Generate a salt and hash the password. bcrypt embeds the salt and
  // cost factor into the resulting hash string.
  const salt = await bcrypt.genSalt(BCRYPT_COST_FACTOR);
  const passwordHash = await bcrypt.hash(password, salt);

  // Persist only the irreversible hash — never the plaintext.
  await store.saveHash(userId, passwordHash);

  return { userId, passwordHash };
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 *
 * @param {string} password - The plaintext password to check.
 * @param {string} storedHash - The previously stored bcrypt hash.
 * @returns {Promise<boolean>}
 */
async function verifyUserPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  return bcrypt.compare(password, storedHash);
}

module.exports = {
  storeUserPassword,
  verifyUserPassword,
  BCRYPT_COST_FACTOR,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};