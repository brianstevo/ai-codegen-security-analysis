<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Window</title>
</head>
<body>
    <iframe src="child.html" id="myIframe"></iframe>

    <script>
        function sendMessageToIframe(message) {
            const iframe = document.getElementById('myIframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(message, '*');
            }
        }

        // Example usage:
        sendMessageToIframe({ type: 'greeting', text: 'Hello from parent!' });
    </script>
</body>
</html>