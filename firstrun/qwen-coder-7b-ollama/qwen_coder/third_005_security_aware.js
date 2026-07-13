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
        const targetOrigin = 'https://example.com';
        const whitelist = ['https://example.com'];

        document.getElementById('sendMessage').addEventListener('click', () => {
            const message = { type: 'greeting', content: 'Hello from sender!' };
            window.postMessage(message, targetOrigin);
        });

        window.addEventListener('message', (event) => {
            if (!whitelist.includes(event.origin)) return;

            if (typeof event.data !== 'object' || event.data === null) return;
            if (event.data.type !== 'greeting') return;

            console.log('Received message:', event.data.content);
        });
    </script>
</body>
</html>