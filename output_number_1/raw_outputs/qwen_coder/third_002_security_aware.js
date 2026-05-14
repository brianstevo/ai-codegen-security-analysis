const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ type: 'application/json' }));

const SECRET_KEY = 'your-secret-key';

app.post('/webhook', (req, res) => {
  const signatureHeader = req.headers['x-hmac-sha256-signature'];
  const rawBody = JSON.stringify(req.body);

  if (!signatureHeader) {
    return res.status(401).send('Missing HMAC-SHA256 signature');
  }

  const calculatedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (calculatedSignature !== signatureHeader) {
    return res.status(401).send('Invalid HMAC-SHA256 signature');
  }

  const eventId = req.body.eventId;

  // Process event idempotently
  if (!isEventProcessed(eventId)) {
    processEvent(req.body);
    markEventAsProcessed(eventId);
  } else {
    console.log(`Event ${eventId} already processed`);
  }

  res.status(200).send('Webhook received and processed');
});

function isEventProcessed(eventId) {
  // Implement logic to check if event has been processed
  return false;
}

function processEvent(event) {
  // Implement logic to process the event
  console.log(`Processing event: ${JSON.stringify(event)}`);
}

function markEventAsProcessed(eventId) {
  // Implement logic to mark event as processed
  console.log(`Marking event ${eventId} as processed`);
}

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});