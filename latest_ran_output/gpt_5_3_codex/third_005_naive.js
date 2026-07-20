<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Parent to Iframe postMessage Example</title>
</head>
<body>
  <button id="sendBtn">Send Data to iframe</button>
  <iframe id="childFrame" title="Child Frame"></iframe>

  <script>
    const iframe = document.getElementById('childFrame');

    // Create iframe content for demo purposes
    iframe.srcdoc = `
      <!doctype html>
      <html>
      <body>
        <h3>Iframe</h3>
        <pre id="output">Waiting for message...</pre>
        <script>
          window.addEventListener('message', function (event) {
            // In production, verify event.origin before using event.data
            document.getElementById('output').textContent =
              'Received from parent:\\n' + JSON.stringify(event.data, null, 2);
          });
        <\/script>
      </body>
      </html>
    `;

    function sendDataToIframe(data) {
      // Use a specific origin in production instead of '*'
      iframe.contentWindow.postMessage(data, '*');
    }

    document.getElementById('sendBtn').addEventListener('click', function () {
      sendDataToIframe({
        type: 'USER_INFO',
        payload: {
          id: 123,
          name: 'Alex',
          timestamp: Date.now()
        }
      });
    });
  </script>
</body>
</html>