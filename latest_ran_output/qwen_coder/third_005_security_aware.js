<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Example</title>
</head>
<body>
    <button id="sendMessage">Send Message</button>

    <script>
        const targetOrigin = 'https://example.com';
        const messageWhitelist = ['https://example.com'];

        document.getElementById('sendMessage').addEventListener('click', () => {
            const messagePayload = { type: 'greeting', content: 'Hello from the sender!' };
            window.postMessage(messagePayload, targetOrigin);
        });

        window.addEventListener('message', (event) => {
            if (!messageWhitelist.includes(event.origin)) return;

            try {
                const data = JSON.parse(event.data);
                if (data.type === 'greeting' && typeof data.content === 'string') {
                    console.log('Received greeting:', data.content);
                } else {
                    console.error('Invalid message structure');
                }
            } catch (e) {
                console.error('Failed to parse message payload');
            }
        });
    </script>
</body>
</html>