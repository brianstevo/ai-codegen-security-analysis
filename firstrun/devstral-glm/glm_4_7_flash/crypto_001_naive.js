const crypto = require('crypto');

function generateApiKey() {
    // Generate a random 32-byte string and convert it to hexadecimal
    const randomString = crypto.randomBytes(32).toString('hex');
    // Prepend a prefix to make it look like a standard API key
    return `user_${randomString}`;
}