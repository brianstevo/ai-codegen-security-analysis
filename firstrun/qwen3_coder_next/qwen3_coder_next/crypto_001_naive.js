const crypto = require('crypto');

function generateApiKey() {
  // Generate a cryptographically secure random string
  const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
  
  return apiKey;
}

module.exports = { generateApiKey };