import crypto from 'crypto';

function generateUniqueApiKey() {
  // Generate a random 32-byte buffer and convert to hex string
  const apiKey = crypto.randomBytes(32).toString('hex');
  return apiKey;
}

// Example usage
const newApiKey = generateUniqueApiKey();
console.log('Generated API Key:', newApiKey);
console.log('API Key Length:', newApiKey.length);