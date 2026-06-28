<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Window</title>
</head>
<body>
    <iframe src="child.html" id="myIframe"></iframe>
    <button onclick="sendMessage()">Send Message to Iframe</button>

    <script>
        function sendMessage() {
            const iframe = document.getElementById('myIframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'message_from_parent',
                    data: { key: 'value' }
                }, '*'); // Use specific origin in production instead of '*'
            }
        }
    </script>
</body>
</html>