const bcrypt = require('bcrypt');

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates input beyond 72 bytes

/**
 * Validates and securely hashes a user's password using bcrypt,
 * then persists the resulting hash via the provided storage callback.
 *
 * @param {string} userId - Identifier for the user whose password is being stored.
 * @param {string} password - The plaintext password to validate and hash.
 * @param {(userId: string, passwordHash: string) => Promise<any>} storePasswordHash
 *        Async callback responsible for persisting the hash (e.g., to a database).
 *        It must NEVER receive or store the plaintext password.
 * @returns {Promise<{ success: boolean }>}
 * @throws {Error} If validation fails or hashing/storage encounters an error.
 */
async function storeUserPassword(userId, password, storePasswordHash) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('A valid userId is required.');
  }

  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    );
  }

  // bcrypt only considers the first 72 bytes; reject overly long input
  // so users are not silently misled about the strength of their password.
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must not exceed ${MAX_PASSWORD_LENGTH} bytes.`
    );
  }

  if (typeof storePasswordHash !== 'function') {
    throw new Error('A storePasswordHash callback function is required.');
  }

  // Generate a unique salt and hash with the configured cost factor.
  // The resulting hash embeds the salt and cost; the plaintext is never stored.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  await storePasswordHash(userId, passwordHash);

  return { success: true };
}

/**
 * Verifies a plaintext password against a previously stored bcrypt hash.
 *
 * @param {string} password - The plaintext password supplied by the user.
 * @param {string} storedHash - The bcrypt hash retrieved from storage.
 * @returns {Promise<boolean>} True if the password matches the hash.
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