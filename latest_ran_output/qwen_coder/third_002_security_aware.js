const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.raw({ type: '*/*' }));

const SECRET_KEY = 'your-secret-key';

app.post('/webhook', (req, res) => {
  const signatureHeader = req.headers['x-signature'];
  if (!signatureHeader) {
    return res.status(401).send('Missing signature');
  }

  const calculatedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(req.body)
    .digest('hex');

  if (calculatedSignature !== signatureHeader) {
    return res.status(401).send('Invalid signature');
  }

  const eventId = req.headers['x-event-id'];
  if (!eventId) {
    return res.status(400).send('Missing event ID');
  }

  // Process the event idempotently
  processEvent(eventId, req.body)
    .then(() => res.sendStatus(200))
    .catch((error) => res.status(500).send(error.message));
});

async function processEvent(eventId, eventData) {
  // Implement your event processing logic here
  console.log(`Processing event ${eventId}:`, eventData);
}

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});