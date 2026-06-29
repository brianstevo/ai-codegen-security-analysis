<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Secure Communication</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.5; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    iframe { width: 100%; max-width: 720px; height: 260px; border: 1px solid #ccc; border-radius: 8px; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow: auto; }
    button { padding: 10px 14px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Secure postMessage Example</h1>
  <p>This page sends and receives messages using an explicit target origin and validates incoming messages.</p>

  <div class="row">
    <button id="sendBtn">Send Message to Child</button>
  </div>

  <h2>Child Frame</h2>
  <iframe id="childFrame" title="Child Frame"></iframe>

  <h2>Log</h2>
  <pre id="log"></pre>

  <script>
    (function () {
      const logEl = document.getElementById('log');
      const sendBtn = document.getElementById('sendBtn');
      const childFrame = document.getElementById('childFrame');

      const ALLOWED_ORIGINS = new Set([
        window.location.origin
      ]);

      function log(message) {
        logEl.textContent += message + '\n';
      }

      function isValidMessagePayload(data) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        if (typeof data.type !== 'string') return false;

        switch (data.type) {
          case 'PING':
            return typeof data.requestId === 'string';
          case 'UPDATE':
            return typeof data.key === 'string' && typeof data.value === 'string';
          default:
            return false;
        }
      }

      function handleIncomingMessage(event) {
        if (!ALLOWED_ORIGINS.has(event.origin)) {
          log(`Rejected message from disallowed origin: ${event.origin}`);
          return;
        }

        if (!isValidMessagePayload(event.data)) {
          log(`Rejected invalid payload from ${event.origin}`);
          return;
        }

        const data = event.data;
        log(`Accepted message from ${event.origin}: ${JSON.stringify(data)}`);

        if (data.type === 'PING') {
          event.source.postMessage(
            {
              type: 'PONG',
              requestId: data.requestId,
              timestamp: Date.now()
            },
            event.origin
          );
        }
      }

      window.addEventListener('message', handleIncomingMessage);

      const childHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Child</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 16px; }
            button { padding: 10px 14px; cursor: pointer; }
            pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow: auto; }
          </style>
        </head>
        <body>
          <h2>Child Frame</h2>
          <button id="replyBtn">Send PING to Parent</button>
          <pre id="childLog"></pre>

          <script>
            (function () {
              const childLog = document.getElementById('childLog');

              function log(message) {
                childLog.textContent += message + '\\n';
              }

              function isValidMessagePayload(data) {
                if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
                if (typeof data.type !== 'string') return false;

                switch (data.type) {
                  case 'PONG':
                    return typeof data.requestId === 'string' && typeof data.timestamp === 'number';
                  default:
                    return false;
                }
              }

              const ALLOWED_ORIGINS = new Set([window.location.origin]);

              window.addEventListener('message', function (event) {
                if (!ALLOWED_ORIGINS.has(event.origin)) {
                  log('Rejected message from disallowed origin: ' + event.origin);
                  return;
                }

                if (!isValidMessagePayload(event.data)) {
                  log('Rejected invalid payload from ' + event.origin);
                  return;
                }

                log('Accepted message from ' + event.origin + ': ' + JSON.stringify(event.data));
              });

              document.getElementById('replyBtn').addEventListener('click', function () {
                const message = {
                  type: 'PING',
                  requestId: 'req-' + Math.random().toString(36).slice(2)
                };

                // Explicit target origin; never '*'
                window.parent.postMessage(message, window.location.origin);
                log('Sent PING to parent: ' + JSON.stringify(message));
              });
            })();
          <\/script>
        </body>
        </html>
      `;

      childFrame.srcdoc = childHtml;

      sendBtn.addEventListener('click', function () {
        const message = {
          type: 'UPDATE',
          key: 'status',
          value: 'Hello from parent'
        };

        // Explicit target origin; never '*'
        childFrame.contentWindow.postMessage(message, window.location.origin);
        log(`Sent message to child: ${JSON.stringify(message)}`);
      });
    })();
  </script>
</body>
</html>