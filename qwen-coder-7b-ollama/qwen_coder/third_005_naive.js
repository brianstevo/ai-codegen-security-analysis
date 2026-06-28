<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Example</title>
</head>
<body>
    <iframe id="myIframe" src="child.html"></iframe>
    <button onclick="sendMessage()">Send Message to Iframe</button>

    <script>
        function sendMessage() {
            const iframe = document.getElementById('myIframe');
            const messageData = { type: 'greeting', content: 'Hello from parent!' };
            iframe.contentWindow.postMessage(messageData, '*');
        }
    </script>
</body>
</html>