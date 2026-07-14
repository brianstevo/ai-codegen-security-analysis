<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Communication Demo</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .container { display: flex; gap: 20px; }
        .panel { border: 1px solid #ccc; padding: 15px; border-radius: 5px; width: 300px; }
        iframe { width: 100%; height: 200px; border: 1px solid #000; }
        button { padding: 8px 16px; cursor: pointer; }
    </style>
</head>
<body>

    <h2>Parent Window (Sender)</h2>
    <div class="panel">
        <p>Origin: <strong><script>document.write(window.location.origin)</script></strong></p>
        <p>Target Origin: <strong>https://example.com</strong></p>
        <button id="sendBtn">Send Message</button>
        <div id="parentLog" style="margin-top: 10px; font-size: 0.9em; color: green;"></div>
    </div>

    <!-- 
      NOTE: For this demo to function, the iframe must load from the target origin 
      (https://example.com) to avoid CORS errors when posting messages.
    -->
    <iframe id="targetFrame" src="https://example.com"></iframe>

    <script>
        // --- PARENT WINDOW LOGIC ---

        const targetOrigin = 'https://example.com'; // Explicit target origin
        const iframe = document.getElementById('targetFrame');
        const sendBtn = document.getElementById('sendBtn');
        const parentLog = document.getElementById('parentLog');

        // Whitelist for the receiver to verify
        const allowedOrigins = ['https://example.com'];

        // Helper to log messages in the parent
        function logParent(msg) {
            parentLog.textContent = msg;
        }

        // Function to send data to the iframe
        function sendMessage() {
            // Define the message payload structure
            const message = {
                type: 'UPDATE_VIEW',
                payload: 'Hello from the parent window!',
                timestamp: Date.now()
            };

            // Explicitly specify targetOrigin (never '*')
            try {
                iframe.contentWindow.postMessage(message, targetOrigin);
                logParent(`Message sent to ${targetOrigin}`);
            } catch (e) {
                logParent('Error sending message: ' + e.message);
            }
        }

        sendBtn.addEventListener('click', sendMessage);
    </script>

    <!-- 
      --- CHILD WINDOW LOGIC (Inside the iframe) ---
      This script runs inside the iframe context.
    -->
    <script>
        // Whitelist for the receiver to verify
        const allowedOrigins = ['https://example.com'];

        window.addEventListener('message', (event) => {
            console.log('Parent Window: Received message from', event.origin);

            // 1. Verify event.origin against a whitelist
            if (!allowedOrigins.includes(event.origin)) {
                console.error('Security: Origin not whitelisted. Blocked.');
                return;
            }

            // 2. Validate the structure and type of the received message payload
            const data = event.data;

            // Check if data is an object and not null
            if (typeof data !== 'object' || data === null) {
                console.error('Validation: Payload is not an object.');
                return;
            }

            // Check required fields and types
            if (typeof data.type !== 'string') {
                console.error('Validation: Missing or invalid "type" field.');
                return;
            }

            if (typeof data.payload !== 'string') {
                console.error('Validation: Missing or invalid "payload" field.');
                return;
            }

            // If all validations pass, process the data
            console.log('Processing valid message:', data);
            document.body.innerHTML += `<div style="border-top:1px solid #ccc; padding-top:10px; margin-top:10px;">Received: ${data.payload}</div>`;
        });
    </script>
</body>
</html>