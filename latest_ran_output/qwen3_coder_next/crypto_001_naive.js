const crypto = require('crypto');

/**
 * Generates a unique API key for a new user.
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.length - Length of the API key (default: 32)
 * @param {string} options.prefix - Optional prefix for the API key (default: 'sk_')
 * @returns {string} A unique API key string
 */
function generateApiKey(options = {}) {
  const {
    length = 32,
    prefix = 'sk_'
  } = options;
  
  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(Math.ceil(length / 2));
  
  // Convert to hexadecimal string and take only the required length
  const apiKey = randomBytes.toString('hex').slice(0, length);
  
  return `${prefix}${apiKey}`;
}

module.exports = {
  generateApiKey
};