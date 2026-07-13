<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent to Iframe postMessage</title>
    <style>
        body {
            font-family: sans-serif;
            padding: 20px;
            display: flex;
            gap: 20px;
        }
        .container {
            flex: 1;
        }
        iframe {
            width: 100%;
            height: 300px;
            border: 1px solid #ccc;
            background-color: #f9f9f9;
        }
        button {
            padding: 10px 20px;
            cursor: pointer;
            font-size: 16px;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Parent Window</h2>
    <p>Click the button to send a message to the iframe.</p>
    <button id="sendBtn">Send Message to Iframe</button>
    
    <!-- 
      Note: In a real-world scenario, this would point to an external URL.
      For this demo, we use 'srcdoc' to simulate an embedded document 
      that listens for messages within the same file context.
    -->
    <iframe id="myIframe" srcdoc="
        <style>body{font-family:sans-serif;padding:20px;}</style>
        <h3>Iframe Content</h3>
        <p>Waiting for message...</p>
        <div id='log' style='color:green; font-weight:bold;'></div>
        <script>
            window.addEventListener('message', function(event) {
                // Security check: Verify origin in production
                // if (event.origin !== 'http://localhost:3000') return;

                console.log('Message received from parent:', event.data);
                document.getElementById('log').innerText = 'Received: ' + JSON.stringify(event.data);
            });
        </script>
    "></iframe>
</div>

<script>
    /**
     * Sends data to the specified iframe using postMessage.
     * 
     * @param {HTMLIFrameElement} iframeElement - The DOM element of the iframe.
     * @param {*} data - The data to send (must be serializable).
     * @param {string} targetOrigin - The origin of the target window ('*' for any, or specific URL).
     */
    function sendMessageToIframe(iframeElement, data, targetOrigin = '*') {
        if (!iframeElement) {
            console.error("Iframe element not found.");
            return;
        }

        // Access the contentWindow of the iframe
        const iframeWindow = iframeElement.contentWindow;

        if (iframeWindow) {
            iframeWindow.postMessage(data, targetOrigin);
            console.log(`Message sent to iframe:`, data);
        } else {
            console.error("Could not access iframe content window.");
        }
    }

    // --- Implementation Logic ---

    const sendBtn = document.getElementById('sendBtn');
    const myIframe = document.getElementById('myIframe');

    sendBtn.addEventListener('click', () => {
        const payload = {
            type: 'GREETING',
            content: 'Hello from the parent window!',
            timestamp: new Date().toISOString()
        };

        // Send the message
        sendMessageToIframe(myIframe, payload);
    });
</script>

</body>
</html>