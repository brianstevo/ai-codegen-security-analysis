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
        <button id="sendMessage">Send Message</button>
        <p id="senderStatus"></p>
    </div>

    <div id="receiver">
        <h2>Receiver Window</h2>
        <p id="receiverStatus"></p>
    </div>

    <script>
        // Configuration
        const TARGET_ORIGIN = "http://localhost:8080"; // Explicit target origin
        const WHITELISTED_ORIGINS = ["http://localhost:8080"]; // Whitelist for receiver

        // Sender code
        document.getElementById('sendMessage').addEventListener('click', () => {
            try {
                const messageData = {
                    type: "test",
                    payload: { value: 42, timestamp: Date.now() },
                    metadata: { sender: "window1" }
                };

                // Send message with explicit target origin
                window.parent.postMessage(messageData, TARGET_ORIGIN);
                document.getElementById('senderStatus').textContent = "Message sent!";
            } catch (error) {
                document.getElementById('senderStatus').textContent = `Error: ${error.message}`;
            }
        });

        // Receiver code
        window.addEventListener('message', (event) => {
            try {
                // Verify origin against whitelist
                if (!WHITELISTED_ORIGINS.includes(event.origin)) {
                    throw new Error(`Blocked message from untrusted origin: ${event.origin}`);
                }

                // Validate message structure and types
                const requiredFields = ['type', 'payload', 'metadata'];
                for (const field of requiredFields) {
                    if (!(field in event.data)) {
                        throw new Error(`Missing required field: ${field}`);
                    }
                }

                if (typeof event.data.type !== 'string') {
                    throw new Error('Invalid type: must be string');
                }

                if (typeof event.data.payload !== 'object' || event.data.payload === null) {
                    throw new Error('Invalid payload: must be object');
                }

                if (typeof event.data.metadata !== 'object' || event.data.metadata === null) {
                    throw new Error('Invalid metadata: must be object');
                }

                // Process valid message
                document.getElementById('receiverStatus').textContent =
                    `Received message from ${event.origin}: Type=${event.data.type}, ` +
                    `Value=${event.data.payload.value}, Sender=${event.data.metadata.sender}`;

            } catch (error) {
                document.getElementById('receiverStatus').textContent = `Error: ${error.message}`;
            }
        });
    </script>
</body>
</html>