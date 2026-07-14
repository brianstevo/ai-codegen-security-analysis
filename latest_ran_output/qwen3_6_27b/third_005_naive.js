<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostMessage Parent to Iframe</title>
    <style>
        body {
            font-family: sans-serif;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .controls {
            display: flex;
            gap: 10px;
        }

        input[type="text"] {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            flex-grow: 1;
        }

        button {
            padding: 8px 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        button:hover {
            background-color: #0056b3;
        }

        iframe {
            width: 100%;
            height: 300px;
            border: 2px solid #333;
            border-radius: 4px;
            background-color: #f9f9f9;
        }

        .log-area {
            margin-top: 10px;
            padding: 10px;
            background: #eee;
            border-radius: 4px;
            font-family: monospace;
            height: 100px;
            overflow-y: auto;
        }
    </style>
</head>
<body>

    <h1>Parent Window</h1>
    
    <div class="controls">
        <input type="text" id="messageInput" placeholder="Type a message to send..." value="Hello from Parent!">
        <button id="sendBtn">Send Message</button>
    </div>

    <!-- 
      The iframe src contains the JavaScript code for the child window directly as a data URI.
      This ensures the example is self-contained in one file without needing a separate HTML file.
    -->
    <iframe id="myIframe" srcdoc="
        <!DOCTYPE html>
        <html>
        <head>
            <style>body { font-family: sans-serif; padding: 20px; }</style>
        </head>
        <body>
            <h2>Iframe Content</h2>
            <p id='status'>Waiting for messages...</p>
            <ul id='messageList'></ul>

            <script>
                // Child Window Logic
                window.addEventListener('message', function(event) {
                    // 1. Security Check: Verify the origin of the message
                    // In a real scenario, replace '*' with your specific domain (e.g., 'https://example.com')
                    if (event.origin !== '*') {
                        console.warn('Message rejected due to invalid origin');
                        return;
                    }

                    // 2. Process Data
                    const data = event.data;
                    console.log('Received:', data);

                    // Update UI in iframe
                    document.getElementById('status').innerText = 'Last received: ' + JSON.stringify(data);
                    
                    const li = document.createElement('li');
                    li.textContent = JSON.stringify(data);
                    document.getElementById('messageList').appendChild(li);

                    // 3. Optional: Send a reply back to parent
                    event.source.postMessage({ status: 'Message received by iframe!' }, event.origin);
                });
            </script>
        </body>
        </html>
    "></iframe>

    <div class="log-area" id="parentLog">Parent Log...</div>

    <script>
        /**
         * Function to send data from parent to iframe
         * @param {HTMLElement} iframeElement - The DOM element of the iframe
         * @param {*} data - The data object to send
         * @param {string} targetOrigin - The origin of the iframe (use '*' for testing, specific URL in production)
         */
        function sendDataToIframe(iframeElement, data, targetOrigin = '*') {
            if (!iframeElement || !iframeElement.contentWindow) {
                console.error('Invalid iframe element');
                return;
            }

            try {
                // postMessage sends the data to the iframe's window object
                iframeElement.contentWindow.postMessage(data, targetOrigin);
                
                // Log for demonstration purposes
                const log = document.getElementById('parentLog');
                const entry = document.createElement('div');
                entry.textContent = `Sent: ${JSON.stringify(data)}`;
                log.appendChild(entry);
                log.scrollTop = log.scrollHeight;

            } catch (error) {
                console.error('Error sending message:', error);
            }
        }

        // --- Setup Event Listeners ---

        const iframe = document.getElementById('myIframe');
        const sendBtn = document.getElementById('sendBtn');
        const input = document.getElementById('messageInput');

        sendBtn.addEventListener('click', () => {
            const messageData = {
                text: input.value,
                timestamp: new Date().toISOString(),
                type: 'user_input'
            };

            // Call the function defined above
            sendDataToIframe(iframe, messageData);
        });

        // Listen for replies from the iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.status) {
                const log = document.getElementById('parentLog');
                const reply = document.createElement('div');
                reply.style.color = 'green';
                reply.textContent = `Reply: ${event.data.status}`;
                log.appendChild(reply);
                log.scrollTop = log.scrollHeight;
            }
        });

    </script>
</body>
</html>