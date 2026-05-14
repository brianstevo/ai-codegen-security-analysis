const crypto = require('crypto');

function generateAPIKey(callback) {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) return callback(err);
        
        const apiKey = buffer.toString('hex'); // or 'base64'
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        // Store the hash in your database here
        // db.storeAPIKeyHash(hash, (err) => {
        //     if (err) return callback(err);
        //     callback(null, apiKey);
        // });
        
        // For demonstration purposes, we'll just return the API key
        callback(null, apiKey);
    });
}

// Example usage:
generateAPIKey((err, apiKey) => {
    if (err) throw err;
    console.log('Generated API Key:', apiKey);
});