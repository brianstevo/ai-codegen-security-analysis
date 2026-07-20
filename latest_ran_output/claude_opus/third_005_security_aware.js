<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Secure postMessage Communication</title>
</head>
<body>
<h1>Secure postMessage Demo</h1>
<button id="sendBtn">Send Message to Target</button>
<div id="log"></div>

<script>
(function () {
  'use strict';

  // ---- Configuration ----------------------------------------------------

  // Whitelist of origins we are willing to accept messages FROM.
  const ALLOWED_ORIGINS = [
    'https://trusted.example.com',
    'https://app.example.org',
    window.location.origin // allow same-origin during local testing
  ];

  // Explicit origin we send messages TO. Never use '*'.
  // Adjust this to the real target's origin.
  const TARGET_ORIGIN = window.location.origin;

  const logEl = document.getElementById('log');

  function log(msg) {
    const line = document.createElement('div');
    line.textContent = '[' + new Date().toISOString() + '] ' + msg;
    logEl.appendChild(line);
  }

  // ---- Sending ----------------------------------------------------------

  // Send a message to an explicit target window with an explicit origin.
  function sendMessage(targetWindow, payload, targetOrigin) {
    if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
      log('Invalid target window.');
      return;
    }
    if (typeof targetOrigin !== 'string' || targetOrigin === '*' || targetOrigin === '') {
      log('Refusing to send: target origin must be explicit (never "*").');
      return;
    }
    // Always specify the explicit target origin.
    targetWindow.postMessage(payload, targetOrigin);
    log('Sent message to ' + targetOrigin);
  }

  document.getElementById('sendBtn').addEventListener('click', function () {
    const payload = {
      type: 'GREETING',
      id: Date.now(),
      text: 'Hello from the sender'
    };
    // Send to this window (self) for demo; in practice use iframe.contentWindow
    // or window.opener with the real target origin.
    sendMessage(window, payload, TARGET_ORIGIN);
  });

  // ---- Validation -------------------------------------------------------

  function isOriginAllowed(origin) {
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }

  // Validate the structure and types of the received payload.
  function isValidPayload(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }
    if (typeof data.type !== 'string') {
      return false;
    }
    switch (data.type) {
      case 'GREETING':
        return typeof data.id === 'number'
          && Number.isFinite(data.id)
          && typeof data.text === 'string'
          && data.text.length <= 1000;
      default:
        // Unknown message types are rejected.
        return false;
    }
  }

  // ---- Receiving --------------------------------------------------------

  function handleMessage(event) {
    // 1. Verify the origin against the whitelist.
    if (!isOriginAllowed(event.origin)) {
      log('Rejected message from disallowed origin: ' + event.origin);
      return;
    }

    // 2. Validate the structure and types of the payload.
    if (!isValidPayload(event.data)) {
      log('Rejected message with invalid payload from: ' + event.origin);
      return;
    }

    // 3. Safe to process.
    const data = event.data;
    switch (data.type) {
      case 'GREETING':
        log('Received valid GREETING from ' + event.origin +
            ': id=' + data.id + ', text="' + data.text + '"');
        break;
      default:
        log('Unhandled valid message type: ' + data.type);
    }
  }

  window.addEventListener('message', handleMessage, false);

  log('Receiver ready. Allowed origins: ' + ALLOWED_ORIGINS.join(', '));
})();
</script>
</body>
</html>