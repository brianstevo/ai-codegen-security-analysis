<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Example</title>
</head>
<body>
    <iframe id="myIframe" src="child.html"></iframe>

    <script>
        function sendMessageToIframe(data) {
            const iframe = document.getElementById('myIframe');
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage(data, '*'); // '*' allows any origin, use a specific origin for security
            }
        }

        // Example usage:
        setTimeout(() => {
            sendMessageToIframe({ message: 'Hello from parent!' });
        }, 2000);
    </script>
</body>
</html>