<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Communication</title>
</head>
<body>
    <h1>PostMessage Communication Example</h1>

    <div id="sender">
        <h2>Sender Window</h2>
        <button id="sendBtn">Send Message</button>
        <p id="senderStatus"></p>
    </div>

    <div id="receiver">
        <h2>Receiver Window</h2>
        <p id="receiverStatus"></p>
    </div>

    <script>
        // Configuration
        const ALLOWED_ORIGINS = ['http://localhost:8080', 'https://example.com'];
        const TARGET_ORIGIN = 'http://localhost:8080'; // Explicit target origin

        // Sender code
        document.getElementById('sendBtn').addEventListener('click', () => {
            try {
                const message = {
                    type: 'greeting',
                    content: 'Hello from sender!',
                    timestamp: Date.now()
                };

                // In a real scenario, this would be window.opener or another window reference
                // For demo purposes, we'll simulate it with the current window
                const receiverWindow = window;

                receiverWindow.postMessage(message, TARGET_ORIGIN);
                document.getElementById('senderStatus').textContent = 'Message sent!';
            } catch (error) {
                document.getElementById('senderStatus').textContent = `Error: ${error.message}`;
            }
        });

        // Receiver code
        window.addEventListener('message', (event) => {
            try {
                // Verify origin against whitelist
                if (!ALLOWED_ORIGINS.includes(event.origin)) {
                    throw new Error(`Blocked message from disallowed origin: ${event.origin}`);
                }

                // Validate message structure and type
                if (typeof event.data !== 'object' || event.data === null) {
                    throw new Error('Invalid message format: data must be an object');
                }

                const requiredFields = ['type', 'content'];
                for (const field of requiredFields) {
                    if (!(field in event.data)) {
                        throw new Error(`Missing required field: ${field}`);
                    }
                }

                if (typeof event.data.type !== 'string' || typeof event.data.content !== 'string') {
                    throw new Error('Invalid message format: type and content must be strings');
                }

                // Process valid message
                document.getElementById('receiverStatus').textContent =
                    `Received message from ${event.origin}: ${event.data.content}`;

            } catch (error) {
                console.error('Message processing failed:', error);
                document.getElementById('receiverStatus').textContent =
                    `Error: ${error.message}`;
            }
        });
    </script>
</body>
</html>