<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parent to Iframe postMessage</title>
<style>
  body { font-family: sans-serif; margin: 20px; }
  #controls { margin-bottom: 15px; }
  input { padding: 6px; width: 250px; }
  button { padding: 6px 12px; cursor: pointer; }
  iframe { width: 100%; height: 200px; border: 1px solid #ccc; }
  #log { margin-top: 10px; color: #555; font-size: 13px; }
</style>
</head>
<body>
  <h2>Parent Window</h2>
  <div id="controls">
    <input type="text" id="messageInput" placeholder="Type a message to send" value="Hello from parent!">
    <button id="sendBtn">Send to Iframe</button>
  </div>
  <div id="log"></div>

  <!-- Embedded iframe using srcdoc so this is a self-contained single file -->
  <iframe id="childFrame" srcdoc='
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:sans-serif;background:#f0f4ff;">
      <h3>Iframe (Child)</h3>
      <p>Received message: <span id="received"><em>none yet</em></span></p>
      <script>
        window.addEventListener("message", function(event) {
          // In production, validate event.origin here.
          var data = event.data;
          var text = (data && data.type === "PARENT_MESSAGE") ? data.payload : String(data);
          document.getElementById("received").textContent = text;

          // Optionally acknowledge back to parent.
          event.source.postMessage({ type: "CHILD_ACK", payload: "Got: " + text }, event.origin);
        });
      <\/script>
    </body>
    </html>
  '></iframe>

  <script>
    /**
     * Sends data from the parent window to an embedded iframe via postMessage.
     * @param {HTMLIFrameElement} iframe - The target iframe element.
     * @param {*} data - The data (any structured-cloneable value) to send.
     * @param {string} [targetOrigin='*'] - The expected origin of the iframe.
     */
    function sendToIframe(iframe, data, targetOrigin) {
      if (!iframe || !iframe.contentWindow) {
        console.error('Invalid iframe or iframe not loaded yet.');
        return;
      }
      targetOrigin = targetOrigin || '*';
      iframe.contentWindow.postMessage(
        { type: 'PARENT_MESSAGE', payload: data },
        targetOrigin
      );
    }

    const iframe = document.getElementById('childFrame');
    const input = document.getElementById('messageInput');
    const log = document.getElementById('log');

    document.getElementById('sendBtn').addEventListener('click', function () {
      sendToIframe(iframe, input.value, '*');
      log.textContent = 'Sent: ' + input.value;
    });

    // Listen for acknowledgements from the iframe.
    window.addEventListener('message', function (event) {
      const data = event.data;
      if (data && data.type === 'CHILD_ACK') {
        log.textContent = 'Iframe replied: ' + data.payload;
      }
    });
  </script>
</body>
</html>