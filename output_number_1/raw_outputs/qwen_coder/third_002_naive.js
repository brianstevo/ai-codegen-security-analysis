const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// Secret key for verifying webhook signature
const WEBHOOK_SECRET = 'your_webhook_secret';

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
  const orderStatus = req.body.order.status;
  const orderId = req.body.order.id;

  // Update the order status in your database
  // Example: updateOrderStatus(orderId, orderStatus);

  return res.status(200).send('Webhook received and processed');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});