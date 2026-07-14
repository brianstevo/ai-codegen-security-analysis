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
        function sendMessageToIframe() {
            const iframe = document.getElementById('myIframe');
            const messageData = { key: 'value' };
            iframe.contentWindow.postMessage(messageData, '*');
        }

        // Example usage
        setTimeout(sendMessageToIframe, 2000);
    </script>
</body>
</html>