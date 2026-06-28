<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>postMessage Parent to Iframe Demo</title>
    <style>
        body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
        #controls { margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px; }
        iframe { width: 100%; height: 200px; border: 2px dashed #666; background: white; }
        input { padding: 8px; width: 250px; }
        button { padding: 8px 15px; cursor: pointer; }
    </style>
</head>
<body>

    <h1>Parent Window</h1>
    <div id="controls">
        <input type="text" id="messageInput" placeholder="Enter message for iframe...">
        <button onclick="handleSend()">Send to Iframe</button>
    </div>

    <!-- The target iframe -->
    <iframe id="myIframe"></iframe>

    <script>
        /**
         * Core function to send data to an embedded iframe
         * @param {string} iframeId - The ID of the iframe element
         * @param {any} data - The data to send (can be object, string, number, etc)
         * @param {string} targetOrigin - The origin of the receiver (use '*' for any, or a specific URL for security)
         */
        function sendMessageToIframe(iframeId, data, targetOrigin = '*') {
            const iframe = document.getElementById(iframeId);
            if (!iframe) {
                console.error("Iframe not found");
                return;
            }

            // Access the window object of the iframe and call postMessage
            iframe.contentWindow.postMessage(data, targetOrigin);
        }

        // UI Handler
        function handleSend() {
            const input = document.getElementById('messageInput');
            const message = input.value;
            
            // Sending an object to demonstrate complex data transfer
            const payload = {
                text: message,
                timestamp: new Date().toLocaleTimeString(),
                type: 'GREETING'
            };

            sendMessageToIframe('myIframe', payload);
            input.value = ''; 
        }

        /**
         * SETUP FOR DEMONSTRATION PURPOSES:
         * Since we are in a single file, we create the iframe content using a Blob URL
         * to simulate a separate document context.
         */
        const iframeHtml = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background: #fffbe6; padding: 20px;">
                <h3>Iframe Window</h3>
                <div id="display" style="font-weight: bold; color: #d35400;">Waiting for message...</div>
                <script>
                    // Listen for messages from the parent window
                    window.addEventListener('message', (event) => {
                        // SECURITY: In production, always verify event.origin!
                        // if (event.origin !== 'https://expected-parent-domain.com') return;

                        const display = document.getElementById('display');
                        const data = event.data;

                        if (data && data.text) {
                            display.innerText = \`Received: "\${data.text}" at \${data.timestamp}\`;
                        } else {
                            display.innerText = 'Received unknown data format';
                        }
                    });
                <\/script>
            </body>
            </html>
        `;

        const blob = new Blob([iframeHtml], { type: 'text/html' });
        document.getElementById('myIframe').src = URL.createObjectURL(blob);
    </script>
</body>
</html>