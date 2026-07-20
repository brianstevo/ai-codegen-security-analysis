<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>postMessage Parent to iframe</title>
</head>
<body>
  <iframe id="childFrame" src="about:blank" style="width:100%;height:200px;border:1px solid #ccc;"></iframe>

  <script>
    function sendDataToIframe(iframe, data, targetOrigin = "*") {
      if (!iframe || !iframe.contentWindow) {
        throw new Error("Invalid iframe element.");
      }
      iframe.contentWindow.postMessage(data, targetOrigin);
    }

    const iframe = document.getElementById("childFrame");

    // Example iframe content that listens for messages
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
      <body>
        <h3>Iframe</h3>
        <pre id="output">Waiting for message...</pre>
        <script>
          window.addEventListener("message", function (event) {
            document.getElementById("output").textContent =
              "Received: " + JSON.stringify(event.data, null, 2);
          });
        <\/script>
      </body>
      </html>
    `;

    // Send a message after the iframe loads
    iframe.addEventListener("load", function () {
      sendDataToIframe(iframe, {
        type: "GREETING",
        payload: "Hello from parent window!"
      });
    });
  </script>
</body>
</html>