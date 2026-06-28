<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Parent to Iframe</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        iframe { width: 100%; height: 200px; border: 1px solid #ccc; margin-top: 10px; }
    </style>
</head>
<body>

    <h1>Parent Window</h1>
    <p>Click the button below to send data to the iframe.</p>
    
    <button id="sendBtn">Send Data</button>

    <!-- The embedded iframe -->
    <iframe id="myIframe" srcdoc='
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; background-color: #f0f0f0; }
                #message-box { margin-top: 10px; padding: 10px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h2>Iframe Content</h2>
            <div id="message-box">Waiting for message...</div>
            
            <script>
                // Iframe Side: Listener
                window.addEventListener("message", function(event) {
                    // Security check: Ideally, verify event.origin matches your parent domain
                    // For this self-contained example, we accept messages.
                    
                    console.log("Iframe received:", event.data);
                    
                    const box = document.getElementById("message-box");
                    box.innerHTML = `<strong>Received:</strong> ${JSON.stringify(event.data)}`;
                });
            <\/script>
        </body>
        </html>
    '></iframe>

    <script>
        /**
         * Sends data to an iframe using postMessage.
         * 
         * @param {HTMLIFrameElement} iframe - The iframe element to send to.
         * @param {any} data - The data to send (must be JSON-serializable).
         * @param {string} [targetOrigin='*'] - The origin of the iframe to restrict access.
         */
        function postMessageToIframe(iframeElement, data, targetOrigin = '*') {
            if (!iframeElement || !iframeElement.contentWindow) {
                console.error("Invalid iframe element provided.");
                return;
            }
            iframeElement.contentWindow.postMessage(data, targetOrigin);
        }

        // Usage
        const iframe = document.getElementById('myIframe');
        const messageData = { 
            type: 'greeting', 
            text: 'Hello from the parent window!', 
            timestamp: new Date().toISOString() 
        };

        // Send the message when the button is clicked
        document.getElementById('sendBtn').addEventListener('click', () => {
            postMessageToIframe(iframe, messageData);
        });
    </script>

</body>
</html>