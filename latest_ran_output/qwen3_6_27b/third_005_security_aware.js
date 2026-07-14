<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure postMessage Implementation</title>
    <style>
        :root {
            --bg-color: #f4f4f9;
            --text-color: #333;
            --primary-color: #007bff;
            --success-color: #28a745;
            --error-color: #dc3545;
            --border-color: #ddd;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        h1 {
            margin-bottom: 20px;
        }

        .container {
            display: flex;
            gap: 20px;
            width: 100%;
            max-width: 1000px;
            flex-wrap: wrap;
        }

        .panel {
            flex: 1;
            min-width: 300px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .panel h2 {
            margin-top: 0;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 10px;
        }

        iframe {
            width: 100%;
            height: 400px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background-color: #fff;
        }

        .log-container {
            margin-top: 20px;
            width: 100%;
            max-width: 1000px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        #log {
            height: 150px;
            overflow-y: auto;
            background: #f8f9fa;
            border: 1px solid var(--border-color);
            padding: 10px;
            font-family: monospace;
            font-size: 0.9em;
        }

        .log-entry {
            margin-bottom: 5px;
            padding: 2px 0;
            border-bottom: 1px solid #eee;
        }

        .log-success { color: var(--success-color); }
        .log-error { color: var(--error-color); font-weight: bold; }
        .log-info { color: var(--primary-color); }

        button {
            padding: 10px 20px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            transition: background 0.2s;
        }

        button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>

    <h1>Secure postMessage Communication</h1>

    <div class="container">
        <!-- Parent Panel -->
        <div class="panel">
            <h2>Parent Window (Sender)</h2>
            <p>This window sends messages to the iframe.</p>
            <button id="sendBtn">Send Secure Message</button>
            <p><small>Note: The target origin is explicitly set to match the current domain.</small></p>
        </div>

        <!-- Iframe Panel -->
        <div class="panel">
            <h2>Iframe (Receiver)</h2>
            <iframe id="childFrame" srcdoc="
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: sans-serif; padding: 10px; }
                        h3 { margin-top: 0; color: #444; }
                        .status { padding: 5px; border-radius: 3px; margin-bottom: 5px; display: block; }
                        .ok { background-color: #d4edda; color: #155724; }
                        .err { background-color: #f8d7da; color: #721c24; }
                    </style>
                </head>
                <body>
                    <h3>Iframe Console</h3>
                    <div id='iframeLog'></div>

                    <script>
                        // --- IFRAME LOGIC ---

                        const iframeLog = document.getElementById('iframeLog');

                        function log(msg, type) {
                            const div = document.createElement('span');
                            div.className = 'status ' + (type === 'error' ? 'err' : 'ok');
                            div.textContent = msg;
                            iframeLog.prepend(div);
                        }

                        // 1. Define Whitelist of allowed origins
                        // In a real scenario, this would be specific domains like 'https://trusted-partner.com'
                        const ALLOWED_ORIGINS = [window.location.origin]; 

                        window.addEventListener('message', function(event) {
                            // 2. Verify Origin against whitelist
                            if (!ALLOWED_ORIGINS.includes(event.origin)) {
                                log('Blocked message from unauthorized origin: ' + event.origin, 'error');
                                return;
                            }

                            const data = event.data;

                            // 3. Validate Structure and Type
                            if (typeof data !== 'object' || data === null) {
                                log('Rejected: Payload is not an object.', 'error');
                                return;
                            }

                            if (!data.type || typeof data.type !== 'string') {
                                log('Rejected: Missing or invalid message type.', 'error');
                                return;
                            }

                            if (data.type === 'GREETING' && (typeof data.payload !== 'string')) {
                                log('Rejected: Greeting payload must be a string.', 'error');
                                return;
                            }

                            // 4. Process Data
                            log('Received valid message: ' + JSON.stringify(data), 'ok');
                            
                            // Optional: Send response back to parent
                            event.source.postMessage({ 
                                type: 'RESPONSE', 
                                payload: 'Message received successfully by iframe!' 
                            }, event.origin);
                        });
                    <\/script>
                </body>
                </html>
            "></iframe>
        </div>
    </div>

    <div class="log-container">
        <h2>Parent Console</h2>
        <div id="log"></div>
    </div>

    <script>
        // --- PARENT WINDOW LOGIC ---

        const sendBtn = document.getElementById('sendBtn');
        const logDiv = document.getElementById('log');
        const iframe = document.getElementById('childFrame');

        function parentLog(msg, type) {
            const div = document.createElement('div');
            div.className = `log-entry log-${type}`;
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logDiv.prepend(div);
        }

        // 1. Define Whitelist for incoming messages (responses)
        const ALLOWED_ORIGINS = [window.location.origin];

        // 2. Listen for messages from the iframe
        window.addEventListener('message', function(event) {
            // Verify origin strictly
            if (!ALLOWED_ORIGINS.includes(event.origin)) {
                parentLog(`Security Violation: Blocked message from ${event.origin}`, 'error');
                return;
            }

            const data = event.data;

            // Validate structure
            if (typeof data !== 'object' || data === null) {
                parentLog('Rejected response: Invalid object type.', 'error');
                return;
            }

            if (!data.type || typeof data.type !== 'string') {
                parentLog('Rejected response: Missing message type.', 'error');
                return;
            }

            // Process valid response
            parentLog(`Response from iframe: ${data.payload}`, 'success');
        });

        // 3. Send Message Handler
        sendBtn.addEventListener('click', function() {
            const targetOrigin = window.location.origin; // Explicit origin, never '*'

            const message = {
                type: 'GREETING',
                payload: 'Hello from Parent Window!',
                timestamp: Date.now()
            };

            try {
                iframe.contentWindow.postMessage(message, targetOrigin);
                parentLog(`Sent message to ${targetOrigin}`, 'info');
            } catch (e) {
                parentLog(`Error sending message: ${e.message}`, 'error');
            }
        });

        parentLog('System initialized. Waiting for interaction.', 'info');

    </script>
</body>
</html>