import crypto from 'crypto';
import { Buffer } from 'buffer';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_PASSWORD || 'default-encryption-key-change-in-production', 'salt', 32);

/**
 * Encrypts sensitive user data
 * @param {string} data - The data to encrypt
 * @returns {object} - Object containing encrypted data, iv, and authTag
 */
export function encryptUserData(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: ENCRYPTION_ALGORITHM
  };
}

/**
 * Decrypts sensitive user data
 * @param {object} encryptedObject - Object containing encrypted data, iv, and authTag
 * @returns {string} - The decrypted data
 */
export function decryptUserData(encryptedObject) {
  const { encryptedData, iv, authTag } = encryptedObject;
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypts an entire user object
 * @param {object} userData - The user object containing sensitive fields
 * @param {array} fieldsToEncrypt - Array of field names to encrypt
 * @returns {object} - User object with encrypted fields
 */
export function encryptSensitiveFields(userData, fieldsToEncrypt = ['email', 'phone', 'ssn', 'creditCard']) {
  const encryptedData = { ...userData };
  
  for (const field of fieldsToEncrypt) {
    if (encryptedData[field]) {
      encryptedData[`${field}_encrypted`] = encryptUserData(String(encryptedData[field]));
      // Remove original unencrypted field
      delete encryptedData[field];
    }
  }
  
  return encryptedData;
}

/**
 * Decrypts specific fields in a user object
 * @param {object} encryptedUserData - The encrypted user object
 * @param {array} fieldsToDecrypt - Array of field names to decrypt
 * @returns {object} - User object with decrypted fields
 */
export function decryptSensitiveFields(encryptedUserData, fieldsToDecrypt = ['email', 'phone', 'ssn', 'creditCard']) {
  const decryptedData = { ...encryptedUserData };
  
  for (const field of fieldsToDecrypt) {
    const encryptedField = `${field}_encrypted`;
    if (decryptedData[encryptedField]) {
      decryptedData[field] = decryptUserData(decryptedData[encryptedField]);
      // Remove encrypted field after decryption
      delete decryptedData[encryptedField];
    }
  }
  
  return decryptedData;
}

/**
 * Hash sensitive data for indexing/searching without exposing original
 * @param {string} data - The data to hash
 * @returns {string} - The hashed data
 */
export function hashSensitiveData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create a searchable hash for a field while keeping full encryption for storage
 * @param {object} userData - The user object
 * @param {array} hashableFields - Fields to create searchable hashes for
 * @returns {object} - User object with both encrypted data and searchable hashes
 */
export function encryptWithSearchableHash(userData, hashableFields = ['email', 'phone']) {
  const result = { ...userData };
  
  for (const field of hashableFields) {
    if (result[field]) {
      const dataValue = String(result[field]);
      result[`${field}_encrypted`] = encryptUserData(dataValue);
      result[`${field}_hash`] = hashSensitiveData(dataValue);
      delete result[field];
    }
  }
  
  return result;
}

// Example usage and test
const testData = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  ssn: '123-45-6789',
  creditCard: '4532-1234-5678-9010'
};

console.log('Original user data:', testData);

// Encrypt sensitive fields
const encryptedUser = encryptSensitiveFields(testData, ['email', 'phone', 'ssn', 'creditCard']);
console.log('\nEncrypted user data:', encryptedUser);

// Decrypt sensitive fields
const decryptedUser = decryptSensitiveFields(encryptedUser, ['email', 'phone', 'ssn', 'creditCard']);
console.log('\nDecrypted user data:', decryptedUser);

// Encrypt with searchable hashes
const searchableUser = encryptWithSearchableHash(testData, ['email', 'phone']);
console.log('\nUser with searchable hashes:', searchableUser);

// Verify we can find by hash
const emailToFind = 'john@example.com';
const emailHash = hashSensitiveData(emailToFind);
console.log(`\nSearching for email hash: ${emailHash}`);
console.log(`Matches user's email hash: ${emailHash === searchableUser.email_hash}`);