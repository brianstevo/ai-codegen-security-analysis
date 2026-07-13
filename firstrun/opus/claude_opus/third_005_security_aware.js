<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Secure postMessage Communication</title>
</head>
<body>
<h1>Secure postMessage Demo</h1>
<button id="sendBtn">Send Message to Iframe</button>
<div id="log"></div>

<iframe id="childFrame" src="about:blank" style="display:none"></iframe>

<script>
(function () {
  'use strict';

  // --- Configuration ---------------------------------------------------

  // Explicit target origin to send messages to (never use '*').
  // Set this to the exact origin of the trusted peer/iframe.
  var TARGET_ORIGIN = window.location.origin;

  // Whitelist of origins we are willing to accept messages from.
  var ALLOWED_ORIGINS = [
    window.location.origin
    // , 'https://trusted.example.com'
  ];

  var logEl = document.getElementById('log');

  function log(msg) {
    var p = document.createElement('p');
    p.textContent = msg;
    logEl.appendChild(p);
  }

  // --- Validation ------------------------------------------------------

  // Validate the structure and types of an incoming message payload.
  function isValidPayload(data) {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    if (typeof data.type !== 'string') {
      return false;
    }
    if (typeof data.id !== 'number' || !Number.isFinite(data.id)) {
      return false;
    }
    if (typeof data.text !== 'string') {
      return false;
    }
    // Restrict to known message types.
    var allowedTypes = ['greeting', 'ping', 'update'];
    if (allowedTypes.indexOf(data.type) === -1) {
      return false;
    }
    return true;
  }

  // --- Receiver --------------------------------------------------------

  function handleMessage(event) {
    // 1. Verify the sender's origin against the whitelist.
    if (ALLOWED_ORIGINS.indexOf(event.origin) === -1) {
      log('Rejected message from untrusted origin: ' + event.origin);
      return;
    }

    // 2. Validate the structure and types of the payload.
    if (!isValidPayload(event.data)) {
      log('Rejected message with invalid payload from: ' + event.origin);
      return;
    }

    // 3. Safe to process.
    var data = event.data;
    log('Received [' + data.type + '] id=' + data.id + ': ' + data.text +
        ' (from ' + event.origin + ')');
  }

  window.addEventListener('message', handleMessage, false);

  // --- Sender ----------------------------------------------------------

  function sendMessage(targetWindow, payload) {
    if (!isValidPayload(payload)) {
      log('Refused to send invalid payload.');
      return;
    }
    // Always specify an explicit target origin (never '*').
    targetWindow.postMessage(payload, TARGET_ORIGIN);
    log('Sent [' + payload.type + '] id=' + payload.id + ' to ' + TARGET_ORIGIN);
  }

  // --- Demo wiring -----------------------------------------------------

  var msgCounter = 0;

  document.getElementById('sendBtn').addEventListener('click', function () {
    msgCounter += 1;
    var payload = {
      type: 'greeting',
      id: msgCounter,
      text: 'Hello from parent #' + msgCounter
    };
    // Send to our own window for demonstration.
    sendMessage(window, payload);
  });
})();
</script>
</body>
</html>