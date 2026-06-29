<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Parent to Iframe</title>
</head>
<body>
  <button id="sendBtn">Send Data to Iframe</button>
  <iframe
    id="childFrame"
    srcdoc="
      <!DOCTYPE html>
      <html>
        <body>
          <h3>Iframe</h3>
          <pre id='output'>Waiting for message...</pre>
          <script>
            window.addEventListener('message', function (event) {
              document.getElementById('output').textContent =
                'Received from parent:\n' + JSON.stringify(event.data, null, 2);
            });
          <\/script>
        </body>
      </html>
    "
    style="width: 100%; height: 200px; border: 1px solid #ccc;"
  ></iframe>

  <script>
    const iframe = document.getElementById('childFrame');

    function sendDataToIframe(data) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(data, '*');
    }

    document.getElementById('sendBtn').addEventListener('click', () => {
      sendDataToIframe({
        type: 'GREETING',
        message: 'Hello from the parent window!',
        timestamp: Date.now()
      });
    });
  </script>
</body>
</html>