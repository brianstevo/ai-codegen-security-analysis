<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Parent to Iframe postMessage</title>
</head>
<body>
  <iframe
    id="childFrame"
    title="Child iframe"
    style="width:100%;max-width:700px;height:220px;border:1px solid #ccc;"
    srcdoc="
      <!doctype html>
      <html>
      <body style='font-family:sans-serif;padding:12px;'>
        <h3>Iframe</h3>
        <pre id='output'>Waiting for message...</pre>
        <script>
          window.addEventListener('message', function(event) {
            // In production, validate event.origin before trusting data
            document.getElementById('output').textContent =
              'Received from parent:\\n' + JSON.stringify(event.data, null, 2);
          });
        <\/script>
      </body>
      </html>
    ">
  </iframe>

  <script>
    function sendDataToIframe(iframeEl, data, targetOrigin = "*") {
      if (!iframeEl || !iframeEl.contentWindow) return false;
      iframeEl.contentWindow.postMessage(data, targetOrigin);
      return true;
    }

    const iframe = document.getElementById("childFrame");

    iframe.addEventListener("load", () => {
      sendDataToIframe(iframe, {
        type: "PARENT_DATA",
        message: "Hello from parent window",
        timestamp: Date.now()
      });
    });
  </script>
</body>
</html>