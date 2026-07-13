<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>postMessage Parent to Iframe</title>
</head>
<body>
  <h1>Parent Window</h1>
  <input type="text" id="messageInput" placeholder="Type a message">
  <button id="sendBtn">Send to Iframe</button>

  <h2>Embedded Iframe</h2>
  <iframe id="childFrame" width="400" height="200" style="border:1px solid #ccc;"></iframe>

  <script>
    // The origin of the iframe content. Use a specific origin in production
    // instead of '*' for security. Here we use the same origin via srcdoc.
    const TARGET_ORIGIN = '*';

    const iframe = document.getElementById('childFrame');

    // Inline iframe document that listens for messages from the parent.
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: sans-serif;">
        <h3>Iframe received:</h3>
        <pre id="output">(nothing yet)</pre>
        <script>
          window.addEventListener('message', function (event) {
            // In production, validate event.origin here:
            // if (event.origin !== 'https://expected-origin.com') return;
            const out = document.getElementById('output');
            out.textContent = JSON.stringify(event.data, null, 2);

            // Optionally reply back to the parent
            event.source.postMessage(
              { type: 'ack', received: event.data },
              event.origin === 'null' ? '*' : event.origin
            );
          });
        <\/script>
      </body>
      </html>
    `;

    /**
     * Sends data from the parent window to the embedded iframe.
     * @param {*} data - Any structured-cloneable data to send.
     * @param {string} [targetOrigin='*'] - The target origin for the iframe.
     */
    function sendToIframe(data, targetOrigin = TARGET_ORIGIN) {
      if (!iframe.contentWindow) {
        console.warn('Iframe is not ready yet.');
        return;
      }
      iframe.contentWindow.postMessage(data, targetOrigin);
    }

    // Wire up the button to send a message.
    document.getElementById('sendBtn').addEventListener('click', function () {
      const value = document.getElementById('messageInput').value;
      sendToIframe({
        type: 'greeting',
        text: value || 'Hello from the parent!',
        timestamp: Date.now()
      });
    });

    // Listen for replies from the iframe.
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'ack') {
        console.log('Iframe acknowledged:', event.data.received);
      }
    });

    // Send an initial message once the iframe has loaded.
    iframe.addEventListener('load', function () {
      sendToIframe({ type: 'init', text: 'Iframe loaded and ready.' });
    });
  </script>
</body>
</html>