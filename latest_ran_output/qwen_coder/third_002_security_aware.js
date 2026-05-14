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

  if (crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(calculatedSignature))) {
    const eventId = req.headers['x-event-id'];
    if (!eventId) {
      return res.status(401).send('Missing event ID');
    }

    // Process the event idempotently
    processEvent(eventId, req.body)
      .then(() => res.sendStatus(200))
      .catch((error) => res.status(500).send(error.message));
  } else {
    return res.status(401).send('Invalid signature');
  }
});

async function processEvent(eventId, eventData) {
  // Your event processing logic here
  console.log(`Processing event ${eventId}:`, eventData);
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});