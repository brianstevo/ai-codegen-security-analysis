import crypto from 'crypto';

// Load encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}

// Validate that the key is exactly 32 bytes (256 bits) for AES-256
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256');
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {string} JSON string containing base64-encoded IV, ciphertext, and authTag
 */
export function encryptData(plaintext) {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV, ciphertext, and authTag as base64-encoded strings
  const encryptedData = {
    iv: iv.toString('base64'),
    ciphertext: ciphertext,
    authTag: authTag.toString('base64')
  };
  
  return JSON.stringify(encryptedData);
}

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param {string} encryptedDataJson - JSON string containing IV, ciphertext, and authTag
 * @returns {string} The decrypted plaintext
 */
export function decryptData(encryptedDataJson) {
  const encryptedData = JSON.parse(encryptedDataJson);
  
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertext = encryptedData.ciphertext;
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Generates a random encryption key and returns it as hex string
 * @returns {string} 32-byte random key as hex string
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Example usage and testing
if (process.env.NODE_ENV !== 'production') {
  // For testing, generate a key if not provided
  if (!process.env.ENCRYPTION_KEY) {
    console.log('Generating test encryption key...');
    const testKey = generateEncryptionKey();
    console.log('Test ENCRYPTION_KEY:', testKey);
  }
}

// Test the encryption and decryption
try {
  const testData = 'This is sensitive information that needs to be encrypted';
  console.log('Original data:', testData);
  
  const encrypted = encryptData(testData);
  console.log('Encrypted data:', encrypted);
  
  const decrypted = decryptData(encrypted);
  console.log('Decrypted data:', decrypted);
  
  console.log('Encryption/Decryption successful:', testData === decrypted);
} catch (error) {
  console.error('Encryption test failed:', error.message);
}