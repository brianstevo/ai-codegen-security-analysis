<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Communication</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background-color: #f4f4f9;
        }
        .container {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        .parent-panel {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            width: 300px;
        }
        iframe {
            width: 100%;
            height: 200px;
            border: 1px solid #ccc;
            border-radius: 8px;
            background-color: #fff;
        }
        button {
            background-color: #007BFF;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .output {
            margin-top: 15px;
            font-size: 14px;
            color: #333;
        }
    </style>
</head>
<body>

    <h2>Parent Window (Sender)</h2>
    
    <div class="container">
        <div class="parent-panel">
            <p>Click the button to send a message to the iframe.</p>
            <button id="sendBtn">Send Message</button>
            <div class="output" id="status">Status: Waiting...</div>
        </div>

        <!-- The Iframe -->
        <iframe id="myIframe"></iframe>
    </div>

    <script>
        // --- 1. The Sender Function ---
        function sendMessageToIframe(iframeElement, message) {
            // Determine the target origin.
            // In a production app, use iframeElement.src to get the specific origin.
            // For this demo, we use '*' to allow communication with the data URI iframe.
            const targetOrigin = '*';

            // Send the message
            iframeElement.contentWindow.postMessage(message, targetOrigin);
            
            console.log('Parent sent:', message);
        }

        // --- 2. Usage ---
        document.addEventListener('DOMContentLoaded', () => {
            const iframe = document.getElementById('myIframe');
            const sendBtn = document.getElementById('sendBtn');
            const statusDiv = document.getElementById('status');

            // Set the iframe source to a data URI containing the receiver logic
            // This ensures the code runs in a single file without external dependencies.
            const iframeContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { padding: 20px; font-family: sans-serif; color: #333; }
                        .received-box { margin-top: 20px; padding: 10px; background: #e9ecef; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <h3>Iframe (Receiver)</h3>
                    <p>Waiting for data...</p>
                    <div id="output" class="received-box">No data received yet.</div>
                    
                    <script>
                        // Receiver Logic
                        window.addEventListener('message', (event) => {
                            // SECURITY NOTE: In production, verify event.origin matches your expected domain.
                            // Since this is a data URI demo, we accept the message.
                            
                            const outputDiv = document.getElementById('output');
                            outputDiv.textContent = \`Received: \${event.data}\`;
                            outputDiv.style.color = 'green';
                        });
                    <\/script>
                </body>
                </html>
            `;
            iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(iframeContent);

            // Event Listener for the button
            sendBtn.addEventListener('click', () => {
                const data = {
                    type: 'user_action',
                    payload: 'Hello from the parent window!',
                    timestamp: new Date().toISOString()
                };
                
                sendMessageToIframe(iframe, data);
                statusDiv.textContent = 'Status: Message sent successfully!';
                statusDiv.style.color = 'green';
            });
        });
    </script>
</body>
</html>