const crypto = require('crypto');

function generateAPIKey() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(32, (err, buffer) => {
            if (err) {
                return reject(err);
            }
            const apiKey = buffer.toString('hex'); // or 'base64'
            const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
            // Store the hash in your database here
            resolve(apiKey);
        });
    });
}

module.exports = generateAPIKey;