<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Example</title>
</head>
<body>
    <h1>Sender Page</h1>
    <button id="sendMessage">Send Message</button>

    <script>
        const targetOrigin = 'http://example.com';
        const messageWhitelist = ['http://example.com'];

        document.getElementById('sendMessage').addEventListener('click', () => {
            const message = { type: 'greeting', content: 'Hello from sender!' };
            window.postMessage(message, targetOrigin);
        });

        window.addEventListener('message', (event) => {
            if (!messageWhitelist.includes(event.origin)) return;

            const data = event.data;
            if (typeof data !== 'object' || data === null) return;

            if (data.type === 'greeting' && typeof data.content === 'string') {
                console.log('Received greeting:', data.content);
            }
        });
    </script>
</body>
</html>