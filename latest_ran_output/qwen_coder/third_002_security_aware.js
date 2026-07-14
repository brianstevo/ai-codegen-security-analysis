const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json({ type: 'application/json' }));

const SECRET_KEY = 'your-secret-key';

function verifyHmacSignature(req) {
  const signature = req.headers['x-signature'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(JSON.stringify(req.body));
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
}

app.post('/webhook', (req, res) => {
  if (!verifyHmacSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventId = req.body.eventId;
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // Process event idempotently
  // ...

  res.status(200).json({ message: 'Event received and processed' });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});