const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Mock database for orders
let orders = [
  { id: 1, status: 'pending' },
  { id: 2, status: 'pending' }
];

// Secret key for webhook verification
const WEBHOOK_SECRET = 'your-webhook-secret';

// Route to handle payment provider webhooks
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-signature'];
  const payload = JSON.stringify(req.body);

  // Verify the signature using HMAC-SHA256
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  if (signature !== calculatedSignature) {
    return res.status(403).send('Invalid signature');
  }

  // Process the webhook payload
  const { orderId, status } = req.body;
  const order = orders.find(o => o.id === orderId);

  if (order) {
    order.status = status;
    console.log(`Order ${orderId} updated to ${status}`);
  } else {
    console.log(`Order ${orderId} not found`);
  }

  res.sendStatus(204);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});