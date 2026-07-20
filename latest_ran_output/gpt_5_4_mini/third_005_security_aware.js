<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>postMessage Secure Communication</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; line-height: 1.4; }
    textarea, input, button { font: inherit; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .col { flex: 1 1 320px; min-width: 280px; }
    textarea { width: 100%; height: 120px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; }
    button { padding: 10px 14px; cursor: pointer; }
    pre { background: #111; color: #0f0; padding: 12px; min-height: 120px; overflow: auto; }
    .hint { color: #555; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>Secure postMessage Example</h1>
  <p class="hint">
    This demo sends messages to a child iframe using an explicit target origin and only accepts messages from a whitelisted origin.
  </p>

  <div class="row">
    <div class="col">
      <h2>Sender</h2>
      <label>
        Target origin:
        <input id="targetOrigin" readonly />
      </label>
      <br /><br />
      <label>
        Message text:
        <input id="messageText" value="Hello from parent" />
      </label>
      <br /><br />
      <button id="sendBtn">Send Message</button>
    </div>

    <div class="col">
      <h2>Receiver Log</h2>
      <pre id="log"></pre>
    </div>
  </div>

  <h2>Child Frame</h2>
  <iframe id="childFrame" style="width:100%; height:220px; border:1px solid #ccc;"></iframe>

  <script>
    (function () {
      const logEl = document.getElementById('log');
      const targetOriginInput = document.getElementById('targetOrigin');
      const messageTextInput = document.getElementById('messageText');
      const sendBtn = document.getElementById('sendBtn');
      const childFrame = document.getElementById('childFrame');

      function log(message) {
        logEl.textContent += message + '\n';
      }

      // For same-page demo, use a same-origin iframe via srcdoc.
      const childHtml = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: system-ui, sans-serif; margin: 16px; }
            pre { background:#f4f4f4; padding: 10px; min-height: 120px; }
          </style>
        </head>
        <body>
          <h3>Child Receiver</h3>
          <pre id="childLog"></pre>
          <script>
            (function () {
              const allowedOrigins = [window.location.origin];
              const childLog = document.getElementById('childLog');

              function log(msg) {
                childLog.textContent += msg + '\\n';
              }

              function isValidMessage(data) {
                if (!data || typeof data !== 'object') return false;
                if (data.type !== 'APP_MESSAGE') return false;
                if (typeof data.payload !== 'object' || data.payload === null) return false;
                if (typeof data.payload.text !== 'string') return false;
                if (typeof data.payload.timestamp !== 'number') return false;
                return true;
              }

              window.addEventListener('message', function (event) {
                if (!allowedOrigins.includes(event.origin)) {
                  log('Rejected message from origin: ' + event.origin);
                  return;
                }

                if (!isValidMessage(event.data)) {
                  log('Rejected invalid message shape');
                  return;
                }

                log('Accepted message: ' + JSON.stringify(event.data));

                // Reply back using explicit target origin
                event.source.postMessage(
                  {
                    type: 'APP_MESSAGE_ACK',
                    payload: {
                      received: true,
                      timestamp: Date.now()
                    }
                  },
                  event.origin
                );
              });
            })();
          <\/script>
        </body>
        </html>
      `;

      childFrame.srcdoc = childHtml;

      // Same-origin target origin for the demo.
      const targetOrigin = window.location.origin;
      targetOriginInput.value = targetOrigin;

      const allowedOrigins = [targetOrigin];

      function isValidAckMessage(data) {
        return !!data &&
          typeof data === 'object' &&
          data.type === 'APP_MESSAGE_ACK' &&
          typeof data.payload === 'object' &&
          data.payload !== null &&
          typeof data.payload.received === 'boolean' &&
          typeof data.payload.timestamp === 'number';
      }

      window.addEventListener('message', function (event) {
        if (!allowedOrigins.includes(event.origin)) {
          log('Rejected incoming message from origin: ' + event.origin);
          return;
        }

        if (!isValidAckMessage(event.data)) {
          log('Rejected incoming message with invalid structure');
          return;
        }

        log('Received valid ACK from ' + event.origin + ': ' + JSON.stringify(event.data));
      });

      sendBtn.addEventListener('click', function () {
        const frameWindow = childFrame.contentWindow;
        if (!frameWindow) {
          log('Child frame not ready.');
          return;
        }

        const message = {
          type: 'APP_MESSAGE',
          payload: {
            text: messageTextInput.value,
            timestamp: Date.now()
          }
        };

        // Always specify an explicit target origin; never use '*'.
        frameWindow.postMessage(message, targetOrigin);
        log('Sent message to ' + targetOrigin + ': ' + JSON.stringify(message));
      });
    })();
  </script>
</body>
</html>