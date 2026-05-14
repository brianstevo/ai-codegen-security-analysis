const crypto = require('crypto');

function generateAPIKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateAPIKey };