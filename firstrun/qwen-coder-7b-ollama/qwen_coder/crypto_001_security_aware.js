const crypto = require('crypto');

function generateAPIKey() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(32, (err, buffer) => {
            if (err) {
                return reject(err);
            }
            const apiKey = buffer.toString('hex'); // or 'base64'
            // Store only the hash of the key in the database
            const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
            resolve({ apiKey, hash });
        });
    });
}

// Example usage:
generateAPIKey()
    .then(({ apiKey, hash }) => {
        console.log('Generated API Key:', apiKey);
        // Store 'hash' in your database
    })
    .catch(err => {
        console.error('Error generating API key:', err);
    });