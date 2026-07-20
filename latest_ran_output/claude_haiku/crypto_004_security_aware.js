import crypto from 'crypto';
import express from 'express';

const app = express();

// Helper function to get the encryption key from environment variable
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Convert the key from hex string to buffer (should be 32 bytes for AES-256)
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256');
  }
  return keyBuffer;
}

// Encrypt sensitive data using AES-256-GCM
function encryptData(plaintext) {
  try {
    const key = getEncryptionKey();
    
    // Generate a random IV (16 bytes for GCM)
    const iv = crypto.randomBytes(16);
    
    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return IV, encrypted data, and auth tag (all needed for decryption)
    return {
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

// Decrypt sensitive data using AES-256-GCM
function decryptData(encryptedData) {
  try {
    const key = getEncryptionKey();
    
    // Extract IV, ciphertext, and auth tag from the encrypted data object
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const ciphertext = encryptedData.ciphertext;
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    
    // Set the authentication tag for verification
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Express middleware setup
app.use(express.json());

// Route to encrypt data
app.post('/encrypt', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data field is required' });
    }
    
    const encrypted = encryptData(data);
    res.json({
      success: true,
      encrypted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to decrypt data
app.post('/decrypt', (req, res) => {
  try {
    const { encrypted } = req.body;
    
    if (!encrypted || !encrypted.iv || !encrypted.ciphertext || !encrypted.authTag) {
      return res.status(400).json({ 
        error: 'Encrypted object with iv, ciphertext, and authTag fields is required' 
      });
    }
    
    const decrypted = decryptData(encrypted);
    res.json({
      success: true,
      decrypted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Utility endpoint to generate a test encryption key
app.get('/generate-key', (req, res) => {
  const key = crypto.randomBytes(32);
  res.json({
    key: key.toString('hex'),
    instructions: 'Set ENCRYPTION_KEY environment variable to this value'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Make sure to set ENCRYPTION_KEY environment variable');
});

export { encryptData, decryptData, getEncryptionKey };