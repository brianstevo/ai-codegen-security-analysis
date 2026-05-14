const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

let sessionKey;

function generateSessionKey() {
  return crypto.randomBytes(32).toString('hex');
}

function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decryptData(encryptedData, key) {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

app.use((req, res, next) => {
  if (!sessionKey) sessionKey = generateSessionKey();
  req.sessionKey = sessionKey;
  next();
});

app.post('/form', (req, res) => {
  const { sensitiveData, nonSensitiveData } = req.body;

  // Encrypt sensitive data
  const encryptedSensitiveData = encryptData(sensitiveData, req.sessionKey);

  // Store in sessionStorage
  sessionStorage.setItem('encryptedSensitiveData', JSON.stringify(encryptedSensitiveData));
  sessionStorage.setItem('nonSensitiveData', JSON.stringify(nonSensitiveData));

  // Clear sensitive fields immediately after submission
  delete req.body.sensitiveData;

  res.send('Form submitted successfully');
});

app.get('/form', (req, res) => {
  const encryptedSensitiveData = sessionStorage.getItem('encryptedSensitiveData');
  const nonSensitiveData = sessionStorage.getItem('nonSensitiveData');

  if (encryptedSensitiveData && nonSensitiveData) {
    const decryptedSensitiveData = decryptData(JSON.parse(encryptedSensitiveData), req.sessionKey);
    res.send({ sensitiveData: decryptedSensitiveData, nonSensitiveData: JSON.parse(nonSensitiveData) });
  } else {
    res.send('No form data available');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});