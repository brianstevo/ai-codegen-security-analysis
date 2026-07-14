<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>postMessage Parent to Iframe Demo</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        #controls { margin-bottom: 20px; padding: 15px; background: #f4f4f4; border-radius: 8px; }
        iframe { width: 100%; height: 200px; border: 2px dashed #ccc; }
        input { padding: 8px; width: 250px; }
        button { padding: 8px 16px; cursor: pointer; }
    </style>
</head>
<body>

    <h1>Parent Window</h1>
    <div id="controls">
        <input type="text" id="messageInput" placeholder="Enter message for iframe...">
        <button id="sendBtn">Send to Iframe</button>
    </div>

    <h3>Iframe Content:</h3>
    <iframe id="myIframe"></iframe>

    <script>
        /**
         * Function to send data to the embedded iframe
         * @param {string} message - The data to send
         */
        function sendMessageToIframe(message) {
            const iframe = document.getElementById('myIframe');
            const targetWindow = iframe.contentWindow;

            // Use '*' as the targetOrigin for this demo to allow communication 
            // regardless of origin. In production, replace '*' with the actual 
            // expected origin (e.g., 'https://example.com') for security.
            targetWindow.postMessage({
                type: 'GREETING',
                payload: message,
                timestamp: new Date().toLocaleTimeString()
            }, '*');
        }

        // --- Setup logic to make the demo self-contained ---

        // 1. Create a Blob containing the HTML/JS for the iframe content
        const iframeContent = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background: #eef; padding: 20px;">
                <h4>Iframe Window</h4>
                <div id="display" style="font-weight: bold; color: #333;">Waiting for message...</div>
                
                <script>
                    // Listen for messages from the parent window
                    window.addEventListener('message', (event) => {
                        // Security check: In production, verify event.origin here
                        // if (event.origin !== 'https://trusted-parent.com') return;

                        const data = event.data;
                        if (data && data.type === 'GREETING') {
                            document.getElementById('display').innerText = 
                                \`Received at \${data.timestamp}: "\${data.payload}"\`;
                        }
                    });
                <\/script>
            </body>
            </html>
        `;

        // 2. Convert the string to a Blob URL and assign it to the iframe src
        const blob = new Blob([iframeContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        document.getElementById('myIframe').src = blobUrl;

        // 3. Wire up the UI buttons
        document.getElementById('sendBtn').addEventListener('click', () => {
            const input = document.getElementById('messageInput');
            sendMessageToIframe(input.value || "Hello from Parent!");
        });
    </script>
</body>
</html>